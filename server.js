const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 50 * 1024 * 1024 });

const PORT = 3000;

// ── Change this to your own admin password ─────────────────
const ADMIN_PASSWORD = 'admin123';

// ── State ──────────────────────────────────────────────────
const users   = new Map();
const admins  = new Set();
let filterWords = [];
const kickLog = [];

// ── Uploads ────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random()*1e9) + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 50*1024*1024 } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    url: `/uploads/${req.file.filename}`
  });
});

// ── Helpers ────────────────────────────────────────────────
function getUserList() { return Array.from(users.values()); }

function generateAvatar(name) {
  const colors = ['#25D366','#128C7E','#075E54','#34B7F1','#00BCD4','#FF6B6B','#FFD93D','#6BCB77','#4D96FF'];
  const hash = [...(name||'A')].reduce((a,c) => a+c.charCodeAt(0), 0);
  return { initials: (name||'A').slice(0,2).toUpperCase(), color: colors[hash%colors.length] };
}

function containsBannedWord(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return filterWords.some(w => lower.includes(w));
}

function kickUser(sid, reason) {
  const user = users.get(sid);
  if (!user) return;
  kickLog.unshift({ name: user.name, reason, time: Date.now() });
  if (kickLog.length > 100) kickLog.pop();

  io.to(sid).emit('kicked', { reason });
  io.emit('public_message', {
    type: 'system',
    text: `⛔ ${user.name} was removed: ${reason}`,
    time: Date.now()
  });
  setTimeout(() => {
    const s = io.sockets.sockets.get(sid);
    if (s) s.disconnect(true);
  }, 300);
  console.log(`[kick] ${user.name} — ${reason}`);
}

function pushAdminState() {
  const state = { users: getUserList(), filterWords, kickLog: kickLog.slice(0,50) };
  admins.forEach(sid => io.to(sid).emit('admin_state', state));
}

// ── Sockets ────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  socket.on('join', ({ name }) => {
    const user = { id: socket.id, name: name.trim().slice(0,30)||'Anonymous', avatar: generateAvatar(name) };
    users.set(socket.id, user);
    io.emit('user_list', getUserList());
    io.emit('public_message', { type:'system', text:`${user.name} joined the chat`, time:Date.now() });
    pushAdminState();
    console.log(`[join] ${user.name}`);
  });

  socket.on('public_message', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    if (containsBannedWord(data.text)) { kickUser(socket.id, 'Used a banned word'); return; }
    io.emit('public_message', {
      type:'message', id:socket.id, name:user.name, avatar:user.avatar,
      text:data.text, file:data.file||null, reactions:{},
      msgId:`${socket.id}_${Date.now()}`, time:Date.now()
    });
  });

  socket.on('private_message', ({ toId, text, file }) => {
    const sender = users.get(socket.id);
    if (!sender) return;
    if (containsBannedWord(text)) { kickUser(socket.id, 'Used a banned word in private chat'); return; }
    const payload = {
      type:'message', id:socket.id, name:sender.name, avatar:sender.avatar,
      text, file:file||null, msgId:`pm_${socket.id}_${Date.now()}`, time:Date.now()
    };
    socket.to(toId).emit('private_message', { from:socket.id, ...payload });
    socket.emit('private_message_echo', { to:toId, ...payload });
  });

  socket.on('typing_public', ({ typing }) => {
    const user = users.get(socket.id);
    if (!user) return;
    socket.broadcast.emit('typing_public', { id:socket.id, name:user.name, typing });
  });

  socket.on('typing_private', ({ toId, typing }) => {
    const user = users.get(socket.id);
    if (!user) return;
    socket.to(toId).emit('typing_private', { id:socket.id, name:user.name, typing });
  });

  socket.on('react', ({ msgId, emoji, chatType, peerId }) => {
    const payload = { msgId, emoji, userId:socket.id, chatType, peerId };
    if (chatType === 'public') io.emit('react', payload);
    else { socket.emit('react', payload); if (peerId) socket.to(peerId).emit('react', payload); }
  });

  // ── Admin ──────────────────────────────────────────────
  socket.on('admin_login', ({ password }) => {
    if (password === ADMIN_PASSWORD) {
      admins.add(socket.id);
      socket.emit('admin_login_result', { ok:true });
      pushAdminState();
      console.log(`[admin] login: ${socket.id}`);
    } else {
      socket.emit('admin_login_result', { ok:false, error:'Wrong password' });
    }
  });

  socket.on('admin_kick', ({ targetId, reason }) => {
    if (!admins.has(socket.id)) return;
    kickUser(targetId, reason || 'Kicked by admin');
    pushAdminState();
  });

  socket.on('admin_add_word', ({ word }) => {
    if (!admins.has(socket.id)) return;
    const w = word.trim().toLowerCase();
    if (w && !filterWords.includes(w)) filterWords.push(w);
    pushAdminState();
  });

  socket.on('admin_remove_word', ({ word }) => {
    if (!admins.has(socket.id)) return;
    filterWords = filterWords.filter(w => w !== word);
    pushAdminState();
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    admins.delete(socket.id);
    if (user) {
      io.emit('public_message', { type:'system', text:`${user.name} left the chat`, time:Date.now() });
      users.delete(socket.id);
      io.emit('user_list', getUserList());
      pushAdminState();
      console.log(`[-] ${user.name}`);
    }
  });
});

// ── Start ──────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅  LocalChat → http://localhost:${PORT}`);
  console.log(`🔐  Admin panel → http://localhost:${PORT}/admin.html`);
  console.log(`    Password: ${ADMIN_PASSWORD}`);
  console.log(`\n    Press Ctrl+C to stop\n`);
});

function shutdown() {
  console.log('\n🔴  Shutting down...');
  io.emit('server_shutdown');
  setTimeout(() => { io.close(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1000); }, 200);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
