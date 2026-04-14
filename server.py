#!/usr/bin/env python3
"""
LocalChat - Python server
Run: python server.py
"""

import os
import sys
import signal
import uuid
import mimetypes
from pathlib import Path
from datetime import datetime

from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, disconnect
import eventlet
eventlet.monkey_patch()

# ── Setup ──────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
PUBLIC_DIR = BASE_DIR / "public"
UPLOAD_DIR = PUBLIC_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__, static_folder=str(PUBLIC_DIR))
app.config["SECRET_KEY"] = "localchat-secret"
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet",
                    max_http_buffer_size=50 * 1024 * 1024)

PORT = 3000

# ── In-memory state ────────────────────────────────────────
users = {}   # sid -> {id, name, avatar}

AVATAR_COLORS = [
    "#25D366","#128C7E","#075E54","#34B7F1",
    "#00BCD4","#FF6B6B","#FFD93D","#6BCB77","#4D96FF"
]

def make_avatar(name: str) -> dict:
    h = sum(ord(c) for c in (name or "A"))
    return {
        "initials": (name or "A")[:2].upper(),
        "color": AVATAR_COLORS[h % len(AVATAR_COLORS)]
    }

def user_list() -> list:
    return list(users.values())

# ── Static files ───────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(str(PUBLIC_DIR), "index.html")

@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(str(UPLOAD_DIR), filename)

# ── File upload endpoint ───────────────────────────────────
@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    f = request.files["file"]
    ext  = Path(f.filename).suffix
    name = f"{uuid.uuid4().hex}{ext}"
    path = UPLOAD_DIR / name
    f.save(str(path))
    mime = f.content_type or mimetypes.guess_type(f.filename)[0] or "application/octet-stream"
    return jsonify({
        "filename":     name,
        "originalname": f.filename,
        "mimetype":     mime,
        "size":         path.stat().st_size,
        "url":          f"/uploads/{name}"
    })

# ── Socket events ──────────────────────────────────────────
@socketio.on("connect")
def on_connect():
    print(f"[+] Connected: {request.sid}")

@socketio.on("join")
def on_join(data):
    sid  = request.sid
    name = (data.get("name") or "Anonymous")[:30].strip()
    user = {"id": sid, "name": name, "avatar": make_avatar(name)}
    users[sid] = user

    socketio.emit("user_list", user_list())
    socketio.emit("public_message", {
        "type": "system",
        "text": f"{name} joined the chat",
        "time": _now()
    })
    print(f"[join] {name} ({sid})")

@socketio.on("public_message")
def on_public_message(data):
    sid  = request.sid
    user = users.get(sid)
    if not user:
        return
    socketio.emit("public_message", {
        "type":    "message",
        "id":      sid,
        "name":    user["name"],
        "avatar":  user["avatar"],
        "text":    data.get("text", ""),
        "file":    data.get("file"),
        "reactions": {},
        "msgId":   f"{sid}_{_now()}",
        "time":    _now()
    })

@socketio.on("private_message")
def on_private_message(data):
    sid    = request.sid
    to_id  = data.get("toId")
    sender = users.get(sid)
    if not sender or not to_id:
        return

    payload = {
        "type":   "message",
        "id":     sid,
        "name":   sender["name"],
        "avatar": sender["avatar"],
        "text":   data.get("text", ""),
        "file":   data.get("file"),
        "msgId":  f"pm_{sid}_{_now()}",
        "time":   _now()
    }
    # To recipient
    socketio.emit("private_message", {"from": sid, **payload}, to=to_id)
    # Echo back to sender
    socketio.emit("private_message_echo", {"to": to_id, **payload}, to=sid)

@socketio.on("typing_public")
def on_typing_public(data):
    sid  = request.sid
    user = users.get(sid)
    if not user:
        return
    emit("typing_public",
         {"id": sid, "name": user["name"], "typing": data.get("typing", False)},
         broadcast=True, include_self=False)

@socketio.on("typing_private")
def on_typing_private(data):
    sid   = request.sid
    to_id = data.get("toId")
    user  = users.get(sid)
    if not user or not to_id:
        return
    socketio.emit("typing_private",
                  {"id": sid, "name": user["name"], "typing": data.get("typing", False)},
                  to=to_id)

@socketio.on("react")
def on_react(data):
    sid      = request.sid
    msg_id   = data.get("msgId")
    emoji    = data.get("emoji")
    chat_type = data.get("chatType")
    peer_id  = data.get("peerId")

    payload = {"msgId": msg_id, "emoji": emoji, "userId": sid,
               "chatType": chat_type, "peerId": peer_id}

    if chat_type == "public":
        socketio.emit("react", payload)
    else:
        socketio.emit("react", payload, to=sid)
        if peer_id:
            socketio.emit("react", payload, to=peer_id)

@socketio.on("disconnect")
def on_disconnect():
    sid  = request.sid
    user = users.pop(sid, None)
    if user:
        socketio.emit("user_list", user_list())
        socketio.emit("public_message", {
            "type": "system",
            "text": f"{user['name']} left the chat",
            "time": _now()
        })
        print(f"[-] {user['name']} left")

# ── Helpers ────────────────────────────────────────────────
def _now() -> int:
    return int(datetime.utcnow().timestamp() * 1000)

# ── Graceful shutdown ──────────────────────────────────────
def shutdown(sig, frame):
    print("\n🔴  Shutting down server...")
    socketio.emit("server_shutdown")          # tell every browser instantly
    eventlet.sleep(0.25)                      # give the message time to fly
    print("✅  Server closed. Bye!")
    sys.exit(0)

signal.signal(signal.SIGINT,  shutdown)
signal.signal(signal.SIGTERM, shutdown)

# ── Main ───────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"\n✅  LocalChat running at:")
    print(f"   → http://localhost:{PORT}")
    print(f"   → Share your local IP with others on the same network")
    print(f"\n   Press Ctrl+C to stop\n")
    socketio.run(app, host="0.0.0.0", port=PORT, debug=False)
