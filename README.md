# 💬 LocalChat

A full-featured real-time chat app that runs on your local Wi-Fi network — no internet required.  
Looks and feels like WhatsApp. Includes public chat, private DMs, file sharing, emoji, reactions, and a full admin panel.

---

## ⬇️ Download & Install (from GitHub)

### Step 1 — Download the project

**Option A — Using Git (recommended):**
```bash
git clone https://github.com/YOUR_USERNAME/localchat.git
cd localchat
```

**Option B — Download ZIP:**  
Click the green **Code** button on GitHub → **Download ZIP** → Extract it → Open the folder in terminal.

```bash
cd localchat-main
```

---

### Step 2 — Install Node.js (if you don't have it)

Go to **https://nodejs.org** → Download the **LTS** version → Install it.

To check if it's already installed:
```bash
node --version
```
If you see a version number (e.g. `v20.11.0`) you're good to go.

---

### Step 3 — Install packages

Run this **once** inside the project folder:
```bash
npm install
```

This installs everything automatically. No need to install anything else.

---

### Step 4 — Start the server

```bash
npm start
```

Or alternatively:
```bash
node server.js
```

You will see this in the terminal:
```
✅  LocalChat → http://localhost:3000
🔐  Admin panel → http://localhost:3000/admin.html
    Password: admin123

    Press Ctrl+C to stop
```

---

### Step 5 — Open in browser

Open **http://localhost:3000** in any browser.  
Enter your name and start chatting. ✅

---

## 🌐 Share With Others on the Same Wi-Fi

Find your local IP address, then share it with others:

**Mac:**
```bash
ipconfig getifaddr en0
```

**Windows:**
```bash
ipconfig
```
Look for **IPv4 Address** — it looks like `192.168.1.x`

**Linux:**
```bash
hostname -I
```

Share `http://192.168.1.x:3000` — anyone on the same Wi-Fi can open it and join.

---

## 🌐 All URLs

| URL | What it is |
|-----|------------|
| `http://localhost:3000` | Chat app — your device |
| `http://YOUR_LOCAL_IP:3000` | Chat app — other devices on same Wi-Fi |
| `http://localhost:3000/admin.html` | Admin panel — password protected |

---

## 💬 How to Use the Chat

### Joining
- When you first open the app you are asked to enter your name
- Everyone in the chat can see your name
- A **"Username joined the chat"** message appears when you enter

### Public Chat
- Click **Public Chat** in the sidebar
- Everyone connected to the server can read and send messages here

### Private Chat (DMs)
- Click any person's name in the sidebar to open a private conversation
- Only you and that person can see the messages
- If someone sends you a DM while you are in another chat, a pop-up notification appears

### Sending Messages
- Type in the box at the bottom and press **Enter** to send
- Press **Shift + Enter** to add a line break without sending

### Emoji 😊
- Click the **😊** button to open the emoji picker
- 8 categories, 500+ emojis
- Click any emoji to insert it into your message

### Reactions
- Hover over any message — a **😊** button appears on the bubble
- Click it to pick a reaction (👍 ❤️ 😂 😮 😢 🙏)
- Reactions show below the message with a count

### File Sharing 📎
- Click the **📎** button to attach any file (up to 50MB)
- Images are shown as a preview in the chat — click to open fullscreen
- Other files (PDFs, ZIPs, docs) show a download button

### Typing Indicator
- When someone is typing, you see **"Name is typing..."** in real time

### Join & Leave Notifications
- A system message appears in public chat when anyone joins or leaves

---

## 🛡️ Admin Panel

Open **http://localhost:3000/admin.html** in your browser.

**Default password: `admin123`**

### How to change the password
Open `server.js`, find line 13 and change it:
```js
const ADMIN_PASSWORD = 'admin123'; // ← change this to anything
```
Save the file and restart the server.

### Kicking a User
1. Open the admin panel and log in
2. Find the user in the **Online Users** list
3. Click the red **Kick** button next to their name
4. Optionally type a reason
5. Click **Kick** to confirm

The user is instantly disconnected. Everyone in the chat sees:  
`⛔ Username was removed: reason`

### Word Filter
1. Type any word into the filter box and click **+ Add**
2. If anyone types that word in public chat **or** private chat, they are instantly kicked
3. Works in real time — no restart needed
4. Click **✕** on a word tag to remove it from the filter

### Kick History
Every kick is logged with the user's name, reason, and timestamp.

---

## 🔴 Stopping the Server

Press **Ctrl + C** in the terminal.

All connected users immediately see a **"Server Offline"** screen. The server closes cleanly.

---

## ⚙️ Configuration

All settings are at the top of `server.js`:

| Setting | Default | How to change |
|---------|---------|---------------|
| Port | `3000` | Edit `const PORT = 3000` |
| Admin password | `admin123` | Edit `const ADMIN_PASSWORD = 'admin123'` |
| Max file size | `50MB` | Edit `50 * 1024 * 1024` |

---

## 🐍 Python Alternative

If you prefer Python over Node.js:

**Install packages:**
```bash
pip3 install flask flask-socketio eventlet
```

**Start:**
```bash
python3 server.py
```

Everything works the same way.

---

## ❓ Troubleshooting

**`zsh: command not found: node`**  
Node.js is not installed. Download it from https://nodejs.org

**`Cannot GET /`**  
Your `index.html` is not inside the `public/` folder. Move it:
```bash
mkdir public
mv index.html public/
```

**`Cannot find module 'express'`**  
You haven't installed packages yet:
```bash
npm install
```

**Port already in use**  
Something else is using port 3000. Change the port in `server.js`:
```js
const PORT = 8080; // use any free port
```

**Other devices can't connect**  
- Make sure all devices are on the **same Wi-Fi network**
- Use your local IP address, not `localhost`
- Check your firewall is not blocking the port

**`ModuleNotFoundError: No module named 'flask'`**  
Install Python packages:
```bash
pip3 install flask flask-socketio eventlet
```

---

## 📁 Project Structure

```
localchat/
├── server.js          ← Node.js server
├── server.py          ← Python server (alternative)
├── package.json       ← Node.js dependencies
├── .gitignore         ← tells Git what not to upload
├── README.md          ← this file
└── public/
    ├── index.html     ← the chat app
    ├── admin.html     ← the admin panel
    └── uploads/       ← uploaded files are saved here
```

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Server (Node.js) | Express + Socket.io |
| Server (Python) | Flask + Flask-SocketIO |
| Real-time | WebSockets via Socket.io |
| Animations | GSAP 3 |
| File uploads | Multer |
| Frontend | HTML, CSS, Vanilla JavaScript |
| Fonts | Google Fonts — Nunito |

---

## 📤 Pushing to GitHub (for the author)

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/localchat.git
git push -u origin main
```

> The `node_modules/` folder and any uploaded files are excluded automatically via `.gitignore` — only the source code is uploaded.
