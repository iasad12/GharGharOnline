import { Peer, DataConnection } from 'peerjs';
import { GameState, NetworkMessage, Player, PlayerColor, LanRoomInfo } from '../types/game';

export type NetworkEventHandler = (message: NetworkMessage, connectionId?: string) => void;

export class PeerManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private hostConnection: DataConnection | null = null;
  private onMessageCallback: NetworkEventHandler | null = null;
  private onPlayerDisconnectCallback: ((playerId: string) => void) | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lanRelayTimer: ReturnType<typeof setInterval> | null = null;
  private retryJoinTimer: ReturnType<typeof setInterval> | null = null;
  private lastRelaySeq: number = 0;
  private processedMsgIds: Set<string> = new Set();
  private localBus: BroadcastChannel | null = null;
  private rendezvousSocket: WebSocket | null = null;
  private rendezvousPromise: Promise<boolean> | null = null;

  public myPeerId: string | null = null;
  public isHost: boolean = false;
  public roomId: string | null = null;

  constructor() {
    // Setup cross-tab BroadcastChannel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.localBus = new BroadcastChannel('ghar_ghar_local_bus');
      this.localBus.onmessage = (event) => {
        const data = event.data;
        if (data && data.roomId === this.roomId && data.message) {
          this.handleIncomingMessage(data.message, data.senderId, data.msgId);
        }
      };
    }
  }

  /**
   * Initializes the PeerJS instance.
   */
  /**
   * Initializes the PeerJS instance with a fast safety timeout.
   */
  /**
   * Initializes the PeerJS instance with a fast safety timeout.
   */
  public async init(preferredId?: string): Promise<string> {
    return new Promise((resolve) => {
      // Clean up previous peer connection without wiping room identity
      if (this.peer) {
        try { this.peer.destroy(); } catch (e) {}
        this.peer = null;
      }
      for (const conn of this.connections.values()) {
        try { conn.close(); } catch (e) {}
      }
      this.connections.clear();
      if (this.hostConnection) {
        try { this.hostConnection.close(); } catch (e) {}
        this.hostConnection = null;
      }

      let isResolved = false;
      const safeResolve = (id: string) => {
        if (isResolved) return;
        isResolved = true;
        this.myPeerId = id;
        resolve(id);
      };

      // Fallback timeout: proceed if cloud broker doesn't respond in 8000ms
      const fallbackTimer = setTimeout(() => {
        const fallbackId = preferredId || 'peer_' + Math.random().toString(36).substring(2, 9);
        safeResolve(fallbackId);
      }, 8000);

      const config = {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ]
        }
      };

      try {
        if (preferredId) {
          this.peer = new Peer(preferredId, config);
        } else {
          this.peer = new Peer(config);
        }

        this.peer.on('open', (id) => {
          clearTimeout(fallbackTimer);
          safeResolve(id);
        });

        this.peer.on('error', (err) => {
          console.warn('[PeerJS]', err);
          clearTimeout(fallbackTimer);
          safeResolve(preferredId || 'peer_' + Math.random().toString(36).substring(2, 9));
        });

        this.peer.on('connection', (conn) => {
          this.setupHostIncomingConnection(conn);
        });
      } catch (err) {
        clearTimeout(fallbackTimer);
        safeResolve(preferredId || 'peer_' + Math.random().toString(36).substring(2, 9));
      }
    });
  }

  public setCallbacks(
    onMessage: NetworkEventHandler,
    onPlayerDisconnect?: (playerId: string) => void
  ) {
    this.onMessageCallback = onMessage;
    this.onPlayerDisconnectCallback = onPlayerDisconnect || null;
  }

  /**
   * Host creates a room.
   */
  public async hostRoom(roomId: string): Promise<string> {
    const cleanRoomId = roomId.trim().toUpperCase();
    this.isHost = true;
    this.roomId = cleanRoomId;
    const peerId = `ghar-room-${cleanRoomId.toLowerCase()}`;

    // Cloudflare Durable Objects provide the authoritative path in production.
    // The old PeerJS/local relay path remains as a graceful local-development fallback.
    if (!this.myPeerId) {
      this.myPeerId = 'peer_' + Math.random().toString(36).substring(2, 9);
    }
    const connectedToRendezvous = await this.connectToRendezvous();

    if (!connectedToRendezvous) {
      try {
        await this.init(peerId);
      } catch (e) {
        console.warn('Fallback to auto peerId', e);
      }
    }

    this.isHost = true;
    this.roomId = cleanRoomId;
    this.startLanRelayPolling();
    return this.roomId;
  }

  /**
   * Client joins a room.
   */
  public async joinRoom(
    roomId: string,
    playerInfo: { id: string; name: string; color: PlayerColor }
  ): Promise<boolean> {
    const cleanRoomId = roomId.trim().toUpperCase();
    this.isHost = false;
    this.roomId = cleanRoomId;
    if (!this.myPeerId) {
      this.myPeerId = 'peer_' + Math.random().toString(36).substring(2, 9);
    }
    const targetPeerId = `ghar-room-${cleanRoomId.toLowerCase()}`;

    // Immediately start polling LAN relay for incoming host messages
    this.startLanRelayPolling();
    void this.connectToRendezvous();

    // Prepare JOIN_REQUEST message
    const joinMsg: NetworkMessage = {
      type: 'JOIN_REQUEST',
      player: playerInfo
    };

    // Send JOIN_REQUEST immediately via LAN Relay & BroadcastChannel without waiting
    this.sendToHost(joinMsg);

    // Retry sending JOIN_REQUEST every 500ms up to 20 attempts to guarantee receipt (10s)
    if (this.retryJoinTimer) clearInterval(this.retryJoinTimer);
    let attempts = 0;
    this.retryJoinTimer = setInterval(() => {
      attempts++;
      if (attempts >= 20 || this.isHost) {
        if (this.retryJoinTimer) {
          clearInterval(this.retryJoinTimer);
          this.retryJoinTimer = null;
        }
        return;
      }
      this.sendToHost(joinMsg);
    }, 500);

    const connectToHost = () => {
      if (!this.peer) return;
      try {
        const conn = this.peer.connect(targetPeerId, { reliable: true });
        conn.on('open', () => {
          this.hostConnection = conn;
          conn.send(joinMsg);
        });
        conn.on('data', (data) => {
          this.handleIncomingMessage(data as NetworkMessage, 'host');
        });
        conn.on('close', () => {
          if (this.onPlayerDisconnectCallback) {
            this.onPlayerDisconnectCallback('host');
          }
        });
      } catch (e) {
        console.warn('WebRTC connect error:', e);
      }
    };

    // In parallel, establish WebRTC connection if possible
    if (!this.peer) {
      this.init().then(connectToHost);
    } else {
      connectToHost();
    }

    return true;
  }

  /**
   * Internal dispatcher that deduplicates messages arriving via WebRTC, LAN Relay, or BroadcastChannel.
   */
  private handleIncomingMessage(msg: NetworkMessage, senderId?: string, msgId?: string) {
    if (msgId && this.processedMsgIds.has(msgId)) return;
    if (msgId) {
      this.processedMsgIds.add(msgId);
      if (this.processedMsgIds.size > 200) {
        const first = this.processedMsgIds.values().next().value;
        if (first) this.processedMsgIds.delete(first);
      }
    }

    if (this.onMessageCallback) {
      this.onMessageCallback(msg, senderId);
    }
  }

  /**
   * Host handles incoming connection from a joining player.
   */
  private setupHostIncomingConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
    });

    conn.on('data', (data) => {
      this.handleIncomingMessage(data as NetworkMessage, conn.peer);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (this.onPlayerDisconnectCallback) {
        this.onPlayerDisconnectCallback(conn.peer);
      }
    });
  }

  /**
   * Broadcasts a message to all peers (using WebRTC, LAN Relay, and BroadcastChannel simultaneously).
   */
  public broadcast(message: NetworkMessage) {
    const msgId = `${Date.now()}_${Math.random()}`;
    this.processedMsgIds.add(msgId);

    if (!this.myPeerId) {
      this.myPeerId = 'peer_' + Math.random().toString(36).substring(2, 9);
    }

    // 1. WebRTC DataChannels
    if (this.isHost) {
      for (const conn of this.connections.values()) {
        if (conn.open) {
          try { conn.send(message); } catch (e) {}
        }
      }
    } else if (this.hostConnection && this.hostConnection.open) {
      try { this.hostConnection.send(message); } catch (e) {}
    }

    // 2. Cross-tab BroadcastChannel
    if (this.localBus && this.roomId) {
      try {
        this.localBus.postMessage({
          roomId: this.roomId,
          senderId: this.myPeerId,
          msgId,
          message
        });
      } catch (e) {}
    }

    // 3. Cloudflare room WebSocket. The Durable Object fans this out to every
    // connected player, including users behind different NATs.
    if (this.rendezvousSocket?.readyState === WebSocket.OPEN) {
      try {
        this.rendezvousSocket.send(JSON.stringify({
          type: 'message',
          id: msgId,
          senderId: this.myPeerId,
          message
        }));
      } catch (e) {}
    } else {
      // Open (or re-open) the persistent path for subsequent messages. The
      // HTTP relay below still carries this current message reliably.
      void this.connectToRendezvous();
    }

    // 4. HTTP relay fallback. In production this is also handled by the
    // Durable Object; in local development it is handled by the Vite server.
    if (this.roomId) {
      fetch(`/api/lan-signal?roomId=${encodeURIComponent(this.roomId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: this.roomId,
          senderId: this.myPeerId,
          msgId,
          message
        })
      }).catch(() => {});
    }
  }

  public sendToPeer(peerId: string, message: NetworkMessage) {
    this.broadcast(message);
  }

  public sendToHost(message: NetworkMessage) {
    this.broadcast(message);
  }

  /**
   * LAN Relay Polling loop with monotonic sequence tracking (immune to clock skew).
   */
  private startLanRelayPolling() {
    this.stopLanRelayPolling();
    this.lastRelaySeq = 0;

    this.lanRelayTimer = setInterval(async () => {
      if (!this.roomId) return;
      try {
        const res = await fetch(
          `/api/lan-signal?roomId=${encodeURIComponent(this.roomId)}&peerId=${encodeURIComponent(
            this.myPeerId || ''
          )}&sinceSeq=${this.lastRelaySeq}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.maxSeq === 'number' && data.maxSeq > this.lastRelaySeq) {
          this.lastRelaySeq = data.maxSeq;
        }

        if (Array.isArray(data.messages)) {
          for (const item of data.messages) {
            this.handleIncomingMessage(item.message, item.senderId, item.id);
          }
        }
      } catch (e) {}
    }, 350);
  }

  private stopLanRelayPolling() {
    if (this.lanRelayTimer) {
      clearInterval(this.lanRelayTimer);
      this.lanRelayTimer = null;
    }
  }

  /**
   * Connects to the same-origin Pages Function that proxies requests to the
   * Cloudflare Durable Object.
   */
  private connectToRendezvous(): Promise<boolean> {
    if (!this.roomId || typeof WebSocket === 'undefined') return Promise.resolve(false);
    const roomId = this.roomId;
    if (this.rendezvousSocket?.readyState === WebSocket.OPEN) return Promise.resolve(true);
    if (this.rendezvousPromise) return this.rendezvousPromise;

    const connection = new Promise<boolean>((resolve) => {
      let settled = false;
      let socket: WebSocket | null = null;
      const finish = (connected: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(connected);
      };

      const timeout = setTimeout(() => {
        try { socket?.close(); } catch (e) {}
        finish(false);
      }, 2500);

      try {
        const endpoint = new URL(window.location.origin);
        endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
        endpoint.pathname = `/api/room/${encodeURIComponent(roomId)}`;
        endpoint.search = '';
        endpoint.searchParams.set('clientId', this.myPeerId || 'anonymous');

        socket = new WebSocket(endpoint.toString());
        const activeSocket = socket;
        this.rendezvousSocket = activeSocket;

        activeSocket.onopen = () => finish(true);
        activeSocket.onmessage = (event) => {
          try {
            const envelope = JSON.parse(String(event.data));
            if (envelope?.type === 'message' && envelope.message) {
              this.handleIncomingMessage(envelope.message, envelope.senderId, envelope.id);
            }
          } catch (e) {}
        };
        activeSocket.onerror = () => finish(false);
        activeSocket.onclose = () => {
          if (this.rendezvousSocket === activeSocket) this.rendezvousSocket = null;
          finish(false);
        };
      } catch (e) {
        finish(false);
      }
    });

    this.rendezvousPromise = connection;
    void connection.finally(() => {
      if (this.rendezvousPromise === connection) this.rendezvousPromise = null;
    });
    return connection;
  }

  /**
   * Starts periodic LAN discovery heartbeat (reports every 2s).
   */
  public startLanHeartbeat(info: Omit<LanRoomInfo, 'lastSeen'>) {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    const report = async () => {
      try {
        await fetch('/api/lan-rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(info)
        });
      } catch (e) {}

      try {
        localStorage.setItem(
          'ghar_active_lan_room',
          JSON.stringify({ ...info, lastSeen: Date.now() })
        );
      } catch (e) {}
    };

    report();
    this.heartbeatTimer = setInterval(report, 2000);
  }

  public stopLanHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.isHost) {
      try {
        localStorage.removeItem('ghar_active_lan_room');
      } catch (e) {}

      if (this.roomId) {
        const code = this.roomId;
        fetch(`/api/lan-rooms?roomId=${encodeURIComponent(code)}`, {
          method: 'DELETE',
          keepalive: true
        }).catch(() => {});

        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          try {
            navigator.sendBeacon(`/api/lan-rooms?roomId=${encodeURIComponent(code)}&action=delete`);
          } catch (e) {}
        }
      }
    }
  }

  /**
   * Fetches active LAN rooms from local server.
   */
  public static async fetchLanRooms(): Promise<LanRoomInfo[]> {
    const roomMap = new Map<string, LanRoomInfo>();

    // 1. Fetch from Local LAN Server
    try {
      const res = await fetch('/api/lan-rooms', {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.rooms)) {
          for (const r of data.rooms) {
            // Only keep rooms seen within the last 6 seconds
            if (!r.lastSeen || Date.now() - r.lastSeen < 6000) {
              roomMap.set(r.roomId, r);
            }
          }
        }
      }
    } catch (e) {}

    // 2. Check localStorage for local browser tabs (within 4s only)
    try {
      const stored = localStorage.getItem('ghar_active_lan_room');
      if (stored) {
        const room: LanRoomInfo = JSON.parse(stored);
        if (Date.now() - room.lastSeen < 4000) {
          roomMap.set(room.roomId, room);
        } else {
          localStorage.removeItem('ghar_active_lan_room');
        }
      }
    } catch (e) {}

    return Array.from(roomMap.values());
  }

  /**
   * Clean up all active connections and PeerJS.
   */
  public destroy() {
    this.stopLanHeartbeat();
    this.stopLanRelayPolling();
    if (this.retryJoinTimer) {
      clearInterval(this.retryJoinTimer);
      this.retryJoinTimer = null;
    }

    for (const conn of this.connections.values()) {
      try { conn.close(); } catch (e) {}
    }
    this.connections.clear();

    if (this.hostConnection) {
      try { this.hostConnection.close(); } catch (e) {}
      this.hostConnection = null;
    }

    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }

    if (this.rendezvousSocket) {
      try { this.rendezvousSocket.close(); } catch (e) {}
      this.rendezvousSocket = null;
    }
    this.rendezvousPromise = null;

    this.myPeerId = null;
    this.isHost = false;
    this.roomId = null;
  }
}

export const peerManager = new PeerManager();
