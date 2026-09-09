export type PlayerColor = 
  | '#ef4444' // Crimson Red
  | '#3b82f6' // Ocean Blue
  | '#10b981' // Emerald Green
  | '#f59e0b' // Amber Orange
  | '#8b5cf6'; // Royal Purple

export interface Player {
  id: string;
  name: string;
  initial: string; // 1st letter uppercase
  color: PlayerColor;
  score: number;
  isHost: boolean;
  isBot?: boolean;
  connected?: boolean;
}

export type EdgeOrientation = 'h' | 'v';

export interface Edge {
  id: string; // 'h_r_c' or 'v_r_c'
  orientation: EdgeOrientation;
  r: number;
  c: number;
  claimedBy: string | null; // Player id
  color?: PlayerColor;
}

export interface Cell {
  id: string; // 'cell_r_c'
  r: number;
  c: number;
  claimedBy: string | null;
  initial?: string;
  color?: PlayerColor;
}

export interface GridConfig {
  id: string;
  label: string;
  dotCols: number; // e.g. 10
  dotRows: number; // e.g. 5
  // boxes will be (dotCols - 1) * (dotRows - 1)
  isCustom?: boolean;
  deviceTarget?: 'phone' | 'desktop';
}

export type GameMode = 'multiplayer' | 'pass_and_play' | 'vs_bots';
export type GamePhase = 'lobby' | 'playing' | 'game_over';

export interface GameState {
  grid: GridConfig;
  players: Player[];
  currentTurnIndex: number;
  edges: Record<string, Edge>;
  cells: Record<string, Cell>;
  totalBoxes: number;
  claimedBoxesCount: number;
  phase: GamePhase;
  lastMoveEdgeId: string | null;
  bonusTurnAwarded: boolean;
  winnerIds: string[];
}

export interface LanRoomInfo {
  roomId: string;
  hostName: string;
  dotCols: number;
  dotRows: number;
  currentPlayers: number;
  maxPlayers: number;
  lastSeen: number;
}

// Network messages passed via WebRTC peer connection
export type NetworkMessage = 
  | { type: 'JOIN_REQUEST'; player: { id: string; name: string; color: PlayerColor } }
  | { type: 'JOIN_ACCEPTED'; state: GameState; assignedId: string; targetPlayerId?: string }
  | { type: 'JOIN_REJECTED'; reason: string; targetPlayerId?: string }
  | { type: 'PLAYER_JOINED'; player: Player }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'PLAYER_COLOR_CHANGE'; playerId: string; color: PlayerColor }
  | { type: 'START_GAME'; state: GameState }
  | { type: 'MAKE_MOVE'; edgeId: string; playerId: string }
  | { type: 'SYNC_STATE'; state: GameState }
  | { type: 'REMATCH'; state: GameState }
  | { type: 'PING' }
  | { type: 'PONG' };
