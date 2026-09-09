import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In-memory LAN room registry and signal relay for local Wi-Fi discovery
const lanRooms = new Map();
const lanSignals = new Map(); // roomId -> array of messages
const roomCounters = new Map(); // roomId -> monotonic sequence counter

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'lan-discovery-plugin',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const hostHeader = req.headers.host || 'localhost:5173';
          const url = new URL(req.url || '/', `http://${hostHeader}`);

          // 1. LAN ROOM DISCOVERY API
          if (url.pathname === '/api/lan-rooms') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
              res.statusCode = 204;
              return res.end();
            }

            // Handle immediate beacon delete: POST /api/lan-rooms?roomId=XYZ&action=delete
            const action = url.searchParams.get('action');
            const targetRoomId = url.searchParams.get('roomId');
            if (action === 'delete' && targetRoomId) {
              lanRooms.delete(targetRoomId.trim().toUpperCase());
              res.statusCode = 200;
              return res.end(JSON.stringify({ success: true }));
            }

            if (req.method === 'GET') {
              const now = Date.now();
              // Purge rooms inactive for > 6 seconds (heartbeat is sent every 2s)
              for (const [id, room] of lanRooms.entries()) {
                if (now - room.lastSeen > 6000) {
                  lanRooms.delete(id);
                }
              }
              const roomList = Array.from(lanRooms.values());
              res.statusCode = 200;
              return res.end(JSON.stringify({ rooms: roomList }));
            }

            if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', () => {
                try {
                  const data = JSON.parse(body);
                  if (data.action === 'delete' && data.roomId) {
                    lanRooms.delete(String(data.roomId).trim().toUpperCase());
                    res.statusCode = 200;
                    return res.end(JSON.stringify({ success: true }));
                  }
                  if (data.roomId) {
                    const roomKey = String(data.roomId).trim().toUpperCase();
                    lanRooms.set(roomKey, {
                      ...data,
                      roomId: roomKey,
                      lastSeen: Date.now()
                    });
                    res.statusCode = 200;
                    return res.end(JSON.stringify({ success: true }));
                  }
                } catch (e) {}
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid room data' }));
              });
              return;
            }

            if (req.method === 'DELETE') {
              const rawRoomId = url.searchParams.get('roomId');
              if (rawRoomId) {
                const roomKey = rawRoomId.trim().toUpperCase();
                lanRooms.delete(roomKey);
              }
              res.statusCode = 200;
              return res.end(JSON.stringify({ success: true }));
            }
          }

          // 2. LAN RELAY SIGNALING FALLBACK (Room-scoped monotonic sequencing)
          if (url.pathname === '/api/lan-signal') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
              res.statusCode = 204;
              return res.end();
            }

            if (req.method === 'GET') {
              const rawRoomId = url.searchParams.get('roomId');
              const peerId = url.searchParams.get('peerId');
              const sinceSeq = Number(url.searchParams.get('sinceSeq') || '0');
              const now = Date.now();

              if (!rawRoomId) {
                res.statusCode = 200;
                return res.end(JSON.stringify({ messages: [], maxSeq: 0 }));
              }

              const roomKey = rawRoomId.trim().toUpperCase();
              const roomQueue = lanSignals.get(roomKey) || [];
              const currentRoomSeq = roomCounters.get(roomKey) || 0;
              let pending = [];

              if (sinceSeq > 0) {
                pending = roomQueue.filter(m => m.seq > sinceSeq && m.senderId !== peerId);
              } else {
                // Initial fetch: return recent messages from the past 20 seconds
                pending = roomQueue.filter(m => (now - m.timestamp < 20000) && m.senderId !== peerId);
              }

              res.statusCode = 200;
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
                    const queue = lanSignals.get(roomKey);
                    const currentSeq = (roomCounters.get(roomKey) || 0) + 1;
                    roomCounters.set(roomKey, currentSeq);

                    const newMsg = {
                      id: data.msgId || `${Date.now()}_${Math.random()}`,
                      seq: currentSeq,
                      senderId: data.senderId,
                      message: data.message,
                      timestamp: Date.now()
                    };
                    queue.push(newMsg);
                    if (queue.length > 60) queue.shift();

                    res.statusCode = 200;
                    return res.end(JSON.stringify({ success: true, seq: currentSeq }));
                  }
                } catch (e) {}
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid signal' }));
              });
              return;
            }
          }

          next();
        });
      }
    }
  ],
  server: {
    host: true, // Listen on all network interfaces (LAN)
    port: 5173
  },
  preview: {
    host: true,
    port: 5173
  }
});
