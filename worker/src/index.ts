type RoomInfo = {
  roomId: string;
  hostName: string;
  dotCols: number;
  dotRows: number;
  currentPlayers: number;
  maxPlayers: number;
  lastSeen: number;
  networkIp?: string;
  status?: 'waiting' | 'in_progress';
};

type RelayMessage = {
  id: string;
  seq: number;
  senderId?: string;
  message: unknown;
  timestamp: number;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

/**
 * A single class backs both named game rooms and the named global registry.
 * Cloudflare serializes requests to each object, so game messages retain a
 * consistent ordering without depending on a browser tab or a LAN server.
 */
export class GameRoom {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/lan-rooms') {
      return this.handleRegistry(request, url);
    }
    if (url.pathname === '/api/lan-signal') {
      return this.handleRelay(request, url);
    }
    if (url.pathname.startsWith('/api/room/')) {
      return this.handleSocket(request);
    }
    return json({ error: 'Not found' }, 404);
  }

  private async handleRegistry(request: Request, url: URL): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

    // LAN discovery must fail closed. The Pages Function injects this value
    // only from Cloudflare's trusted CF-Connecting-IP header.
    const callerNetwork = request.headers.get('x-client-network')?.trim() || '';

    if (request.method === 'GET') {
      if (!callerNetwork) return json({ rooms: [] });
      const entries = await this.state.storage.list<RoomInfo>({ prefix: 'room:' });
      const now = Date.now();
      const rooms: RoomInfo[] = [];
      for (const [key, room] of entries) {
        if (now - room.lastSeen > 15_000) {
          await this.state.storage.delete(key);
          continue;
        }

        // 1. Hide games in progress from public / LAN discovery
        if (room.status === 'in_progress') {
          continue;
        }

        // 2. Same Wi-Fi filter: only show rooms created on the exact same network IP
        if (!room.networkIp || room.networkIp !== callerNetwork) {
          continue;
        }

        rooms.push(room);
      }
      return json({ rooms });
    }

    const roomIdFromQuery = url.searchParams.get('roomId')?.trim().toUpperCase();
    if (request.method === 'DELETE' || url.searchParams.get('action') === 'delete') {
      if (roomIdFromQuery) await this.state.storage.delete(`room:${roomIdFromQuery}`);
      return json({ success: true });
    }

    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!callerNetwork) {
      // Do not publish a room to the shared registry without a trusted
      // network identity.
      return json({ success: true, discoverable: false });
    }
    try {
      const body = await request.json() as Partial<RoomInfo> & { action?: string };
      const roomId = String(body.roomId || '').trim().toUpperCase();
      if (!roomId) return json({ error: 'roomId is required' }, 400);
      if (body.action === 'delete' || body.status === 'in_progress') {
        await this.state.storage.delete(`room:${roomId}`);
        return json({ success: true });
      }
      await this.state.storage.put(`room:${roomId}`, {
        roomId,
        hostName: String(body.hostName || 'Host').slice(0, 60),
        dotCols: Number(body.dotCols) || 0,
        dotRows: Number(body.dotRows) || 0,
        currentPlayers: Number(body.currentPlayers) || 1,
        maxPlayers: Number(body.maxPlayers) || 5,
        lastSeen: Date.now(),
        networkIp: callerNetwork,
        status: body.status || 'waiting'
      } satisfies RoomInfo);
      return json({ success: true });
    } catch {
      return json({ error: 'Invalid room data' }, 400);
    }
  }

  private async handleRelay(request: Request, url: URL): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

    if (request.method === 'GET') {
      const peerId = url.searchParams.get('peerId') || '';
      const sinceSeq = Number(url.searchParams.get('sinceSeq') || '0');
      const messages = (await this.state.storage.get<RelayMessage[]>('signals')) || [];
      const currentSeq = (await this.state.storage.get<number>('sequence')) || 0;
      const now = Date.now();
      const pending = messages.filter((item) =>
        item.senderId !== peerId && (sinceSeq > 0 ? item.seq > sinceSeq : now - item.timestamp < 20_000)
      );
      return json({ messages: pending, maxSeq: currentSeq, now });
    }

    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    try {
      const body = await request.json() as { senderId?: string; msgId?: string; message?: unknown };
      if (!body.message) return json({ error: 'message is required' }, 400);
      const messages = (await this.state.storage.get<RelayMessage[]>('signals')) || [];
      const sequence = ((await this.state.storage.get<number>('sequence')) || 0) + 1;
      messages.push({
        id: body.msgId || `${Date.now()}_${Math.random()}`,
        seq: sequence,
        senderId: body.senderId,
        message: body.message,
        timestamp: Date.now()
      });
      await this.state.storage.put('signals', messages.slice(-60));
      await this.state.storage.put('sequence', sequence);
      return json({ success: true, seq: sequence });
    } catch {
      return json({ error: 'Invalid signal' }, 400);
    }
  }

  private handleSocket(request: Request): Response {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return json({ error: 'Expected a WebSocket upgrade' }, 426);
    }
    const clientId = new URL(request.url).searchParams.get('clientId') || 'anonymous';
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ clientId });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(sender: WebSocket, rawMessage: string | ArrayBuffer): Promise<void> {
    let parsed: { type?: string; id?: string; senderId?: string; message?: unknown };
    try {
      parsed = JSON.parse(typeof rawMessage === 'string' ? rawMessage : new TextDecoder().decode(rawMessage));
    } catch {
      return;
    }
    if (parsed.type !== 'message' || !parsed.message) return;

    const attachment = sender.deserializeAttachment() as { clientId?: string } | null;
    const envelope = JSON.stringify({
      type: 'message',
      id: parsed.id || `${Date.now()}_${Math.random()}`,
      senderId: attachment?.clientId || parsed.senderId,
      message: parsed.message
    });
    for (const socket of this.state.getWebSockets()) {
      if (socket !== sender) {
        try { socket.send(envelope); } catch {}
      }
    }
  }
}

export default {
  fetch(): Response {
    return json({ error: 'Use this Worker through the Ghar Ghar Pages project.' }, 404);
  }
};
