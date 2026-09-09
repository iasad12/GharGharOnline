import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');
const PORT = process.env.PORT || 5173;

// In-memory room registry for LAN discovery
const lanRooms = new Map();
const lanSignals = new Map();
let globalSeq = 0;

// Helper to get local Wi-Fi / Ethernet IPv4 address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // API: LAN Room Discovery
  if (reqUrl.pathname === '/api/lan-rooms') {
    res.setHeader('Content-Type', 'application/json');

    // Handle immediate beacon delete: POST /api/lan-rooms?roomId=XYZ&action=delete
    const action = reqUrl.searchParams.get('action');
    const targetRoomId = reqUrl.searchParams.get('roomId');
    if (action === 'delete' && targetRoomId) {
      lanRooms.delete(targetRoomId.trim().toUpperCase());
      return res.end(JSON.stringify({ success: true }));
    }

    if (req.method === 'GET') {
      const now = Date.now();
      // Purge rooms inactive for > 6 seconds
      for (const [id, room] of lanRooms.entries()) {
        if (now - room.lastSeen > 6000) {
          lanRooms.delete(id);
        }
      }
      return res.end(JSON.stringify({ rooms: Array.from(lanRooms.values()) }));
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.action === 'delete' && data.roomId) {
            lanRooms.delete(String(data.roomId).trim().toUpperCase());
            return res.end(JSON.stringify({ success: true }));
          }
          if (data.roomId) {
            const roomKey = String(data.roomId).trim().toUpperCase();
            lanRooms.set(roomKey, {
              ...data,
              roomId: roomKey,
              lastSeen: Date.now()
            });
            return res.end(JSON.stringify({ success: true }));
          }
        } catch (e) {}
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Invalid room data' }));
      });
      return;
    }

    if (req.method === 'DELETE') {
      const rawRoomId = reqUrl.searchParams.get('roomId');
      if (rawRoomId) {
        const roomKey = rawRoomId.trim().toUpperCase();
        lanRooms.delete(roomKey);
      }
      return res.end(JSON.stringify({ success: true }));
    }
  }

  // API: LAN Signal Relay (Room-scoped monotonic sequence)
  if (reqUrl.pathname === '/api/lan-signal') {
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'GET') {
      const rawRoomId = reqUrl.searchParams.get('roomId');
      const peerId = reqUrl.searchParams.get('peerId');
      const sinceSeq = Number(reqUrl.searchParams.get('sinceSeq') || '0');
      const now = Date.now();

      if (!rawRoomId) {
        return res.end(JSON.stringify({ messages: [], maxSeq: 0 }));
      }

      const roomKey = rawRoomId.trim().toUpperCase();
      const roomQueue = lanSignals.get(roomKey) || [];
      const currentRoomSeq = global.lanRoomCounters ? (global.lanRoomCounters.get(roomKey) || 0) : 0;
      let pending = [];

      if (sinceSeq > 0) {
        pending = roomQueue.filter(m => m.seq > sinceSeq && m.senderId !== peerId);
      } else {
        pending = roomQueue.filter(m => (now - m.timestamp < 20000) && m.senderId !== peerId);
      }

      return res.end(JSON.stringify({ messages: pending, maxSeq: currentRoomSeq, now }));
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.roomId && data.message) {
            const roomKey = String(data.roomId).trim().toUpperCase();
            if (!lanSignals.has(roomKey)) {
              lanSignals.set(roomKey, []);
            }
            if (!global.lanRoomCounters) global.lanRoomCounters = new Map();
            const queue = lanSignals.get(roomKey);
            const currentSeq = (global.lanRoomCounters.get(roomKey) || 0) + 1;
            global.lanRoomCounters.set(roomKey, currentSeq);

            queue.push({
              id: data.msgId || `${Date.now()}_${Math.random()}`,
              seq: currentSeq,
              senderId: data.senderId,
              message: data.message,
              timestamp: Date.now()
            });
            if (queue.length > 60) queue.shift();
            return res.end(JSON.stringify({ success: true, seq: currentSeq }));
          }
        } catch (e) {}
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Invalid signal' }));
      });
      return;
    }
  }

  // Static File Serving
  let filePath = path.join(DIST_DIR, reqUrl.pathname === '/' ? 'index.html' : reqUrl.pathname);

  // If dist doesn't exist yet, serve friendly instructional page
  if (!fs.existsSync(DIST_DIR)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`
      <!DOCTYPE html>
      <html>
        <head><title>Ghar Ghar LAN Server</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>Ghar Ghar LAN Server Running!</h2>
          <p>Please run <code>npm run build</code> first to generate the production static files, or use <code>npm run dev</code> for hot-reloading development.</p>
        </body>
      </html>
    `);
  }

  // SPA fallback: if file doesn't exist, serve index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      return res.end('File not found');
    }
    res.setHeader('Content-Type', contentType);
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log('\n======================================================');
  console.log('   🏠 GHAR GHAR LAN MULTIPLAYER SERVER STARTED');
  console.log('======================================================');
  console.log(` > Local Machine:  http://localhost:${PORT}`);
  console.log(` > LAN / Wi-Fi:    http://${localIp}:${PORT}`);
  console.log('------------------------------------------------------');
  console.log(' Share the LAN URL above with any phone or computer on');
  console.log(' the same Wi-Fi network to play together instantly!');
  console.log('======================================================\n');
});
