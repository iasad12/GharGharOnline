import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Users,
  Play,
  Wifi,
  Copy,
  Check,
  QrCode,
  Sparkles,
  Bot,
  Plus,
  Trash2,
  RefreshCw,
  Grid,
  Shield,
  Sliders,
  ChevronRight,
  HelpCircle,
  Smartphone,
  Laptop
} from 'lucide-react';
import { GameMode, GridConfig, LanRoomInfo, Player, PlayerColor } from '../types/game';
import { GRID_PRESETS, PLAYER_COLORS, getFirstLetter } from '../logic/gameEngine';
import { peerManager, PeerManager } from '../network/peerManager';
import { copyToClipboard } from '../logic/clipboard';
import { ClaimedHomeBadge } from './ClaimedHomeBadge';
export { ClaimedHomeBadge };

interface LobbyProps {
  myPlayerName: string;
  setMyPlayerName: (name: string) => void;
  myColor: PlayerColor;
  setMyColor: (color: PlayerColor) => void;
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  selectedGrid: GridConfig;
  setSelectedGrid: (grid: GridConfig) => void;
  // Online state
  roomCode: string;
  setRoomCode: (code: string) => void;
  isHost: boolean;
  players: Player[];
  isWaitingInRoom: boolean;
  onHostGame: () => void;
  onJoinGame: (code?: string) => void;
  onStartGame: () => void;
  onAddBot: () => void;
  onRemovePlayer: (id: string) => void;
  onOpenRules: () => void;
  onStartPassAndPlay: (configuredPlayers: Player[]) => void;
  onStartVsBots: (botCount: number) => void;
  errorMessage: string | null;
  isLoading: boolean;
  onLeaveGame?: () => void;
  darkMode?: boolean;
  lanRooms?: LanRoomInfo[];
  onScanLan?: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  myPlayerName,
  setMyPlayerName,
  myColor,
  setMyColor,
  gameMode,
  setGameMode,
  selectedGrid,
  setSelectedGrid,
  roomCode,
  setRoomCode,
  isHost,
  players,
  isWaitingInRoom,
  onHostGame,
  onJoinGame,
  onStartGame,
  onAddBot,
  onRemovePlayer,
  onOpenRules,
  onStartPassAndPlay,
  onStartVsBots,
  errorMessage,
  isLoading,
  onLeaveGame,
  darkMode = false,
  lanRooms: propLanRooms,
  onScanLan
}) => {
  // Custom grid inputs
  const [customCols, setCustomCols] = useState(12);
  const [customRows, setCustomRows] = useState(7);
  const [showCustomGrid, setShowCustomGrid] = useState(false);

  // LAN rooms discovery state - fallback to local state if not passed from parent
  const [localLanRooms, setLocalLanRooms] = useState<LanRoomInfo[]>([]);
  const [isScanningLan, setIsScanningLan] = useState(false);
  const lanRooms = propLanRooms !== undefined ? propLanRooms : localLanRooms;

  // QR code modal state
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Pass & Play setup
  const [hotseatPlayers, setHotseatPlayers] = useState<Array<{ name: string; color: PlayerColor }>>([
    { name: myPlayerName && myPlayerName !== 'Player 1' ? myPlayerName : 'Asad', color: PLAYER_COLORS[0] },
    { name: 'Yasir', color: PLAYER_COLORS[1] }
  ]);

  // Bot mode setup
  const [botCount, setBotCount] = useState(1);

  // Auto-scan LAN on mount and every 15s while in multiplayer lobby (if not driven by parent)
  useEffect(() => {
    if (propLanRooms !== undefined) return;
    if (gameMode === 'multiplayer' && !isWaitingInRoom) {
      scanLanGames();
      const interval = setInterval(() => {
        PeerManager.fetchLanRooms().then(rooms => {
          setLocalLanRooms(rooms);
        });
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [gameMode, isWaitingInRoom, propLanRooms]);

  const scanLanGames = async () => {
    if (onScanLan) {
      onScanLan();
      return;
    }
    setIsScanningLan(true);
    const rooms = await PeerManager.fetchLanRooms();
    setLocalLanRooms(rooms);
    setIsScanningLan(false);
  };

  // Generate QR code when room code changes
  useEffect(() => {
    if (roomCode) {
      const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
      QRCode.toDataURL(inviteUrl, { width: 280, margin: 2 })
        .then(url => setQrDataUrl(url))
        .catch(() => {});
    }
  }, [roomCode]);

  const copyInvite = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    copyToClipboard(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCustomGridChange = (cols: number, rows: number) => {
    const validCols = Math.min(Math.max(cols, 3), 30);
    const validRows = Math.min(Math.max(rows, 3), 20);
    setCustomCols(validCols);
    setCustomRows(validRows);
    setSelectedGrid({
      id: `custom-${validCols}x${validRows}`,
      label: `Custom (${validCols} × ${validRows})`,
      dotCols: validCols,
      dotRows: validRows,
      isCustom: true
    });
  };

  // -------------------------------------------------------------
  // RENDER: WAITING ROOM LOBBY (WHEN HOSTED OR JOINED ONLINE)
  // -------------------------------------------------------------
  if (isWaitingInRoom) {
    const maxPlayers = 5;
    const canStart = isHost && players.length >= 2;

    return (
      <div className={`flex-1 overflow-y-auto pt-3 sm:pt-6 pb-16 px-3 sm:px-6 md:px-8 flex justify-center items-start transition-colors duration-200 ${darkMode ? 'paper-bg-dark bg-slate-950' : 'paper-bg bg-paper-100'}`}>
        <div className={`w-full max-w-xl rounded-3xl shadow-xl border-2 p-4 sm:p-6 md:p-8 relative transition-colors duration-200 ${
          darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-paper-50 border-paper-300 text-slate-800'
        }`}>
          <div className={`absolute top-0 left-0 right-0 h-3 rounded-t-3xl ${darkMode ? 'bg-sky-500/40' : 'bg-amber-500/50'}`}></div>

          {/* Lobby Header */}
          <div className={`flex items-center justify-between border-b pb-3 mb-4 sm:pb-4 sm:mb-6 ${darkMode ? 'border-slate-800' : 'border-paper-200'}`}>
            <div>
              <span className={`text-xs font-bold tracking-wider uppercase ${darkMode ? 'text-sky-400' : 'text-amber-700'}`}>Online Lobby</span>
              <h2 className={`text-xl sm:text-2xl md:text-3xl font-bold font-sketch ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                Waiting for Players...
              </h2>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-right hidden sm:block">
                <span className={`text-xs font-mono ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Grid Size</span>
                <div className={`text-sm font-bold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                  {selectedGrid.dotCols}×{selectedGrid.dotRows} dots ({ (selectedGrid.dotCols - 1) * (selectedGrid.dotRows - 1) } homes)
                </div>
              </div>
              {onLeaveGame && (
                <button
                  onClick={onLeaveGame}
                  className={`px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-bold rounded-xl border transition-all shadow-sm flex items-center gap-1 cursor-pointer ${
                    darkMode ? 'text-red-400 bg-red-950/40 hover:bg-red-900/40 border-red-900' : 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200'
                  }`}
                  title="Leave Room and return to main screen"
                >
                  <span>Leave</span>
                </button>
              )}
            </div>
          </div>

          {/* Room Code Card */}
          <div className={`rounded-2xl p-4 mb-6 border flex flex-col sm:flex-row items-center justify-between gap-3 ${
            darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-paper-200/80 border-paper-300'
          }`}>
            <div>
              <div className={`text-xs font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>SHARE ROOM CODE</div>
              <div className={`text-3xl font-mono font-extrabold tracking-widest ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                {roomCode}
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={copyInvite}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 font-semibold rounded-xl border shadow-sm transition-all active:scale-95 text-sm cursor-pointer ${
                  darkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-100 border-slate-600' : 'bg-white hover:bg-paper-100 text-slate-800 border-paper-300'
                }`}
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
              <button
                onClick={() => setShowQrModal(true)}
                className={`p-2.5 rounded-xl border shadow-sm transition-all active:scale-95 cursor-pointer ${
                  darkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-100 border-slate-600' : 'bg-white hover:bg-paper-100 text-slate-800 border-paper-300'
                }`}
                title="Scan QR Code"
              >
                <QrCode className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Connected Players List (2 to 5) */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Joined Players ({players.length} / {maxPlayers})
              </span>
              {isHost && players.length < maxPlayers && (
                <button
                  onClick={onAddBot}
                  className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                    darkMode ? 'text-sky-400 bg-sky-950/60 hover:text-sky-300 border-sky-800' : 'text-amber-700 bg-amber-50 hover:text-amber-800 border-amber-200'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Add AI Bot</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {players.map((p, idx) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border shadow-sm ${
                    darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-paper-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ClaimedHomeBadge
                      initial={p.initial}
                      color={p.color}
                      darkMode={darkMode}
                      sizeClass="w-10 h-10"
                    />
                    <div>
                      <div className={`flex items-center gap-1.5 font-bold text-sm ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                        <span>{p.name}</span>
                        {p.isHost && (
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md flex items-center gap-0.5 border ${
                            darkMode ? 'bg-amber-950/80 text-amber-300 border-amber-700' : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}>
                            <Shield className="w-2.5 h-2.5" /> Host
                          </span>
                        )}
                        {p.isBot && (
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md flex items-center gap-0.5 ${
                            darkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'
                          }`}>
                            <Bot className="w-2.5 h-2.5" /> Bot
                          </span>
                        )}
                      </div>
                      <div className={`text-[11px] font-mono ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Player #{idx + 1}
                      </div>
                    </div>
                  </div>

                  {isHost && !p.isHost && (
                    <button
                      onClick={() => onRemovePlayer(p.id)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        darkMode ? 'text-slate-400 hover:text-red-400 hover:bg-red-950/40' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                      }`}
                      title="Kick Player"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              {/* Empty Slots */}
              {Array.from({ length: maxPlayers - players.length }).map((_, i) => (
                <div
                  key={`empty_${i}`}
                  className={`flex items-center gap-3 p-3 rounded-2xl border border-dashed ${
                    darkMode ? 'border-slate-700 bg-slate-800/30 text-slate-500' : 'border-paper-300 bg-paper-100/40 text-slate-400'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl border border-dashed flex items-center justify-center text-lg ${
                    darkMode ? 'border-slate-700 text-slate-600' : 'border-paper-300 text-slate-300'
                  }`}>
                    +
                  </div>
                  <span className="text-xs italic">Waiting for player to connect...</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Button */}
          {isHost ? (
            <button
              onClick={onStartGame}
              disabled={!canStart || isLoading}
              className={`w-full py-3.5 px-6 font-bold text-lg rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 ${
                canStart && !isLoading
                  ? darkMode
                    ? 'bg-sky-600 hover:bg-sky-500 text-white active:scale-98 cursor-pointer'
                    : 'bg-amber-600 hover:bg-amber-700 text-white active:scale-98 cursor-pointer'
                  : darkMode
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-paper-200 text-slate-400 border border-paper-300 cursor-not-allowed'
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{players.length < 2 ? 'Need at least 2 players to start' : 'Start Game Now!'}</span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className={`p-4 border rounded-2xl text-center text-xs font-semibold flex items-center justify-center gap-2 ${
                darkMode ? 'bg-amber-950/40 border-amber-800 text-amber-300' : 'bg-amber-50/90 border-amber-200 text-amber-800'
              }`}>
                <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                <span>Waiting for Host to start the game...</span>
              </div>
              {onLeaveGame && (
                <button
                  onClick={onLeaveGame}
                  className={`w-full py-2.5 px-4 font-semibold text-xs rounded-xl border transition-all text-center cursor-pointer ${
                    darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-paper-100 hover:bg-paper-200 text-slate-700 border-paper-300'
                  }`}
                >
                  Leave Waiting Room
                </button>
              )}
            </div>
          )}
        </div>

        {/* QR Code Modal for Phone Scan */}
        {showQrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
            <div className={`rounded-3xl p-6 md:p-8 max-w-sm w-full text-center shadow-2xl border ${
              darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-paper-300 text-slate-800'
            }`}>
              <h3 className={`text-xl font-bold font-sketch mb-1 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                Scan to Join Game
              </h3>
              <p className={`text-xs mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Point your phone's camera at this QR code to open the game directly!
              </p>
              {qrDataUrl && (
                <div className={`p-3 rounded-2xl inline-block border mb-4 shadow-inner ${
                  darkMode ? 'bg-slate-800 border-slate-700' : 'bg-paper-50 border-paper-200'
                }`}>
                  <img src={qrDataUrl} alt="Room QR Code" className="w-56 h-56 mx-auto rounded-lg" />
                </div>
              )}
              <div className={`text-xs font-mono font-bold mb-4 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Room: {roomCode}
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className={`w-full py-2.5 text-white font-semibold rounded-xl transition-all cursor-pointer ${
                  darkMode ? 'bg-sky-600 hover:bg-sky-500' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: MAIN LOBBY SETUP SCREEN
  // -------------------------------------------------------------
  return (
    <div className={`flex-1 overflow-y-auto pt-3 md:pt-6 pb-20 px-3 md:px-6 flex justify-center items-start transition-colors duration-200 ${
      darkMode ? 'paper-bg-dark bg-slate-950 text-slate-100' : 'paper-bg bg-paper-100 text-slate-800'
    }`}>
      <div className={`w-full max-w-2xl rounded-3xl shadow-xl border-2 p-4 md:p-8 pt-5 md:pt-7 relative transition-colors duration-200 ${
        darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-paper-50 border-paper-300 text-slate-800'
      }`}>
        {/* Notebook top accent line */}
        <div className={`absolute top-0 left-0 right-0 h-3 rounded-t-3xl ${darkMode ? 'bg-sky-500/40' : 'bg-red-400/50'}`}></div>

        {/* Error Alert */}
        {errorMessage && (
          <div className={`mb-4 p-3 border text-xs md:text-sm rounded-xl font-medium ${
            darkMode ? 'bg-red-950/50 border-red-900 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {errorMessage}
          </div>
        )}

        {/* Section 1: Player Identity (Name & Ink Color) */}
        <div className={`rounded-2xl p-3.5 md:p-5 border shadow-sm mb-4 ${
          darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/90 border-paper-200'
        }`}>
          <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${
            darkMode ? 'text-slate-300' : 'text-slate-600'
          }`}>
            Your Player Profile
          </label>
          <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4">
            {/* Stamp preview badge with authentic claimed home style */}
            <ClaimedHomeBadge
              initial={getFirstLetter(myPlayerName)}
              color={myColor}
              darkMode={darkMode}
              sizeClass="w-12 h-12 md:w-14 md:h-14"
              title="Your initial stamped inside claimed homes"
            />

            {/* Name Input */}
            <div className="flex-1 w-full">
              <input
                type="text"
                value={myPlayerName}
                onChange={e => setMyPlayerName(e.target.value)}
                placeholder="e.g. Asad, Yasir, Kamran..."
                maxLength={15}
                className={`w-full px-3.5 py-2 md:py-2.5 rounded-xl border outline-none font-semibold text-sm transition-all ${
                  darkMode
                    ? 'border-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 text-slate-100 bg-slate-900/60'
                    : 'border-paper-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-400 text-slate-800 bg-paper-50/50'
                }`}
              />
              <span className={`text-[11px] mt-1 block ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Initial <strong className={darkMode ? 'text-slate-200' : 'text-slate-700'}>"{getFirstLetter(myPlayerName)}"</strong> will be stamped inside your claimed homes.
              </span>
            </div>

            {/* Ink Color Picker */}
            <div className="flex items-center gap-2 shrink-0">
              {PLAYER_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setMyColor(color)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    myColor === color
                      ? darkMode
                        ? 'scale-125 ring-2 ring-offset-2 ring-sky-400 ring-offset-slate-900 shadow-md'
                        : 'scale-125 ring-2 ring-offset-2 ring-slate-800 ring-offset-white shadow-md'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                  title="Choose ink color"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Section 2: Game Mode Selector (Online / Pass & Play / Solo vs Bots) */}
        <div className="mb-4">
          <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${
            darkMode ? 'text-slate-300' : 'text-slate-600'
          }`}>
            Select Game Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setGameMode('multiplayer')}
              className={`p-2.5 md:p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                gameMode === 'multiplayer'
                  ? darkMode
                    ? 'bg-sky-600 text-white border-sky-500 shadow-md ring-2 ring-sky-400'
                    : 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-400'
                  : darkMode
                    ? 'bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-700'
                    : 'bg-white/90 text-slate-700 border-paper-200 hover:bg-paper-100'
              }`}
            >
              <Wifi className="w-5 h-5" />
              <span className="text-xs md:text-sm font-bold">Online (LAN/WAN)</span>
            </button>

            <button
              onClick={() => setGameMode('pass_and_play')}
              className={`p-2.5 md:p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                gameMode === 'pass_and_play'
                  ? darkMode
                    ? 'bg-sky-600 text-white border-sky-500 shadow-md ring-2 ring-sky-400'
                    : 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-400'
                  : darkMode
                    ? 'bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-700'
                    : 'bg-white/90 text-slate-700 border-paper-200 hover:bg-paper-100'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-xs md:text-sm font-bold">Pass & Play</span>
            </button>

            <button
              onClick={() => setGameMode('vs_bots')}
              className={`p-2.5 md:p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                gameMode === 'vs_bots'
                  ? darkMode
                    ? 'bg-sky-600 text-white border-sky-500 shadow-md ring-2 ring-sky-400'
                    : 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-400'
                  : darkMode
                    ? 'bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-700'
                    : 'bg-white/90 text-slate-700 border-paper-200 hover:bg-paper-100'
              }`}
            >
              <Bot className="w-5 h-5" />
              <span className="text-xs md:text-sm font-bold">Solo vs AI</span>
            </button>
          </div>
        </div>

        {/* Section 3: Grid Size Options (Presets tuned for mobile phone portrait + desktop) */}
        <div className={`rounded-2xl p-3.5 md:p-5 border shadow-sm mb-4 ${
          darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/90 border-paper-200'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              darkMode ? 'text-slate-300' : 'text-slate-600'
            }`}>
              <Grid className={`w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              Grid Dot Size
            </label>
            <span className={`text-xs font-mono font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {(selectedGrid.dotCols - 1) * (selectedGrid.dotRows - 1)} total homes
            </span>
          </div>

          {/* Grid preset pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-2.5">
            {GRID_PRESETS.map(preset => {
              const isSelected = selectedGrid.id === preset.id && !showCustomGrid;
              const homes = (preset.dotCols - 1) * (preset.dotRows - 1);

              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    setSelectedGrid(preset);
                    setShowCustomGrid(false);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? darkMode
                        ? 'bg-amber-950/80 border-amber-600 text-amber-200 font-bold shadow-sm ring-1 ring-amber-400'
                        : 'bg-amber-100/90 border-amber-400 text-slate-900 font-bold shadow-sm ring-1 ring-amber-400'
                      : darkMode
                        ? 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-700'
                        : 'bg-paper-50 border-paper-200 text-slate-700 hover:bg-paper-100'
                  }`}
                >
                  <div className="text-xs font-bold truncate leading-tight">{preset.label}</div>
                  <div className="flex items-center justify-between mt-1.5 pt-0.5">
                    <span className={`text-[10px] font-mono leading-none ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {homes} homes
                    </span>
                    {preset.deviceTarget === 'phone' && (
                      <span title="Tuned for phones (portrait)" className="flex items-center">
                        <Smartphone
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected
                              ? darkMode ? 'text-amber-300' : 'text-amber-700'
                              : darkMode ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        />
                      </span>
                    )}
                    {preset.deviceTarget === 'desktop' && (
                      <span title="Tuned for PCs / Tablets (landscape)" className="flex items-center">
                        <Laptop
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected
                              ? darkMode ? 'text-amber-300' : 'text-amber-700'
                              : darkMode ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Custom Grid Button */}
            <button
              onClick={() => setShowCustomGrid(!showCustomGrid)}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                showCustomGrid
                  ? darkMode
                    ? 'bg-amber-950/80 border-amber-600 text-amber-200 font-bold shadow-sm ring-1 ring-amber-400'
                    : 'bg-amber-100/90 border-amber-400 text-slate-900 font-bold shadow-sm ring-1 ring-amber-400'
                  : darkMode
                    ? 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-700'
                    : 'bg-paper-50 border-paper-200 text-slate-700 hover:bg-paper-100'
              }`}
            >
              <div className="text-xs font-bold leading-tight">Custom...</div>
              <div className="flex items-center justify-between mt-1.5 pt-0.5">
                <span className={`text-[10px] font-mono leading-none ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Custom size
                </span>
                <Sliders className={`w-3.5 h-3.5 shrink-0 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              </div>
            </button>
          </div>

          {/* Custom Grid Sliders Drawer */}
          {showCustomGrid && (
            <div className={`p-3.5 rounded-xl border space-y-3 mt-2 animate-fade-in ${
              darkMode ? 'bg-slate-900/90 border-slate-700' : 'bg-paper-100/90 border-paper-300'
            }`}>
              <div className={`flex items-center justify-between text-xs font-bold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                <span>Custom Configuration</span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono ${darkMode ? 'text-amber-400' : 'text-amber-800'}`}>
                    {customCols} × {customRows} dots ({ (customCols - 1) * (customRows - 1) } homes)
                  </span>
                  <button
                    onClick={() => handleCustomGridChange(customRows, customCols)}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-all ${
                      darkMode ? 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700' : 'bg-white text-slate-600 border-paper-300 hover:bg-paper-200'
                    }`}
                    title="Swap Orientation (Landscape ⇄ Portrait)"
                  >
                    ⇄ Rotate
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className={`flex justify-between text-xs mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    <span>Columns (Width):</span>
                    <strong className="font-mono">{customCols} dots</strong>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={25}
                    value={customCols}
                    onChange={e => handleCustomGridChange(Number(e.target.value), customRows)}
                    className={`w-full ${darkMode ? 'accent-sky-500' : 'accent-amber-600'}`}
                  />
                </div>
                <div>
                  <div className={`flex justify-between text-xs mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    <span>Rows (Height):</span>
                    <strong className="font-mono">{customRows} dots</strong>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={20}
                    value={customRows}
                    onChange={e => handleCustomGridChange(customCols, Number(e.target.value))}
                    className={`w-full ${darkMode ? 'accent-sky-500' : 'accent-amber-600'}`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Mode Specific Controls */}
        {/* 4A. ONLINE MODE: HOST / JOIN / LAN DISCOVERY */}
        {gameMode === 'multiplayer' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Host Game Button */}
              <button
                onClick={onHostGame}
                disabled={isLoading}
                className={`p-3.5 font-bold rounded-2xl shadow-md transition-all flex flex-col items-center justify-center gap-1 active:scale-98 cursor-pointer ${
                  darkMode ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Host New Room</span>
                <span className={`text-[10px] font-normal ${darkMode ? 'text-sky-100' : 'text-amber-100'}`}>
                  Creates room for 2-5 players
                </span>
              </button>

              {/* Join Game Box */}
              <div className={`p-3 rounded-2xl border shadow-sm flex flex-col gap-1.5 justify-center ${
                darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/90 border-paper-200'
              }`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  darkMode ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Join with Room Code
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={e => setRoomCode(e.target.value.toUpperCase())}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && roomCode.trim() && !isLoading) {
                        onJoinGame(roomCode);
                      }
                    }}
                    placeholder="e.g. GHAR-9X2"
                    maxLength={10}
                    className={`flex-1 px-3 py-1.5 rounded-xl border font-mono font-bold text-sm tracking-wider uppercase outline-none transition-all ${
                      darkMode
                        ? 'border-slate-600 focus:border-sky-400 bg-slate-900/60 text-slate-100'
                        : 'border-paper-300 focus:border-amber-600 bg-paper-50 text-slate-800'
                    }`}
                  />
                  <button
                    onClick={() => onJoinGame(roomCode)}
                    disabled={!roomCode.trim() || isLoading}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      darkMode
                        ? 'bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white'
                        : 'bg-amber-600 hover:bg-amber-700 disabled:bg-paper-300 text-white'
                    }`}
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>

            {/* 1. ACTIVE ONLINE GAMES */}
            <div id="nearby-lan-games" className={`rounded-2xl p-3.5 border shadow-sm scroll-mt-16 ${
              darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-paper-100/95 border-paper-300'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Wifi className={`w-4 h-4 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    darkMode ? 'text-slate-200' : 'text-slate-800'
                  }`}>
                    Active Online Games ({lanRooms.length})
                  </span>
                </div>
                <button
                  onClick={scanLanGames}
                  disabled={isScanningLan}
                  className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                    darkMode
                      ? 'text-slate-300 hover:text-white hover:bg-slate-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-paper-200'
                  }`}
                  title="Refresh active games"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanningLan ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {lanRooms.length > 0 ? (
                <div className="space-y-2">
                  {lanRooms.map(r => (
                    <div
                      key={r.roomId}
                      className={`flex items-center justify-between p-3 rounded-2xl border-2 shadow-sm hover:shadow-md transition-all ring-1 ring-emerald-400/20 ${
                        darkMode ? 'bg-slate-900 border-emerald-500/60' : 'bg-white border-emerald-300/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-sketch text-2xl font-bold shadow-inner ${
                          darkMode
                            ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                            : 'bg-emerald-100 border-emerald-300 text-emerald-800'
                        }`}>
                          {getFirstLetter(r.hostName)}
                        </div>
                        <div>
                          <div className={`font-bold text-sm flex items-center gap-1.5 ${
                            darkMode ? 'text-white' : 'text-slate-900'
                          }`}>
                            <span>{r.hostName}'s Game</span>
                            <span className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded ${
                              darkMode ? 'bg-emerald-900/60 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {r.roomId}
                            </span>
                          </div>
                          <div className={`text-[11px] font-mono flex items-center gap-2 mt-0.5 ${
                            darkMode ? 'text-slate-400' : 'text-slate-500'
                          }`}>
                            <span>{r.dotCols}×{r.dotRows} dots</span>
                            <span>•</span>
                            <span>{r.currentPlayers}/{r.maxPlayers} players</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setRoomCode(r.roomId);
                          onJoinGame(r.roomId);
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Join Now</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-center py-3.5 px-3 rounded-xl border border-dashed text-xs ${
                  darkMode ? 'bg-slate-900/40 border-slate-700 text-slate-400' : 'bg-white/60 border-paper-300 text-slate-500'
                }`}>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className={`font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      Auto-discovering active games on your Wi-Fi...
                    </span>
                  </div>
                  <span>Click "Host New Room" above to start a game, or enter a Room Code!</span>
                </div>
              )}
            </div>

            {/* 2. LOCAL WI-FI (LAN) SERVER INFO (Placed BELOW Nearby LAN games) */}
            <div className={`rounded-xl p-3 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
              darkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-paper-100/80 border-paper-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                <div>
                  <span className={`text-[11px] font-bold block ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Local Wi-Fi (LAN) Server
                  </span>
                  <span className={`text-[10px] font-mono ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Open on any phone/PC: <strong className={darkMode ? 'text-slate-200' : 'text-slate-700'}>{typeof window !== 'undefined' ? window.location.origin : ''}</strong>
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    copyToClipboard(window.location.origin);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }
                }}
                className={`px-2 py-1 text-[10px] font-semibold rounded-lg border shadow-sm transition-all cursor-pointer ${
                  darkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600' : 'bg-white hover:bg-paper-200 text-slate-700 border-paper-300'
                }`}
              >
                {copiedLink ? 'Copied URL!' : 'Copy LAN URL'}
              </button>
            </div>
          </div>
        )}

        {/* 4B. PASS & PLAY (LOCAL HOTSEAT) */}
        {gameMode === 'pass_and_play' && (
          <div className="space-y-3">
            <div className={`rounded-2xl p-3.5 border shadow-sm ${
              darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/90 border-paper-200'
            }`}>
              <div className="flex items-center justify-between mb-2.5">
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  darkMode ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  Configure Players ({hotseatPlayers.length} / 5)
                </span>
                {hotseatPlayers.length < 5 && (
                  <button
                    onClick={() => {
                      const nextColor = PLAYER_COLORS[hotseatPlayers.length];
                      const PAKISTANI_NAMES = ['Asad', 'Yasir', 'Kamran', 'Bilal', 'Zain'];
                      const nextName = PAKISTANI_NAMES[hotseatPlayers.length] || `Player ${hotseatPlayers.length + 1}`;
                      setHotseatPlayers([
                        ...hotseatPlayers,
                        { name: nextName, color: nextColor }
                      ]);
                    }}
                    className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                      darkMode
                        ? 'text-sky-400 hover:text-sky-300 bg-sky-950/60 border-sky-800'
                        : 'text-amber-800 hover:text-amber-900 bg-amber-50 border-amber-200'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Player</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {hotseatPlayers.map((player, idx) => (
                  <div key={idx} className={`flex items-center gap-2.5 p-2 rounded-xl border ${
                    darkMode ? 'bg-slate-900 border-slate-700' : 'bg-paper-50 border-paper-200'
                  }`}>
                    <ClaimedHomeBadge
                      initial={getFirstLetter(player.name)}
                      color={player.color}
                      darkMode={darkMode}
                      sizeClass="w-8 h-8"
                    />
                    <input
                      type="text"
                      value={player.name}
                      placeholder={idx === 0 ? "e.g. Asad" : idx === 1 ? "e.g. Yasir" : "e.g. Kamran"}
                      onChange={e => {
                        const updated = [...hotseatPlayers];
                        updated[idx].name = e.target.value;
                        setHotseatPlayers(updated);
                      }}
                      className={`flex-1 px-3 py-1.5 rounded-lg border font-semibold text-sm outline-none transition-all ${
                        darkMode ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-paper-300 text-slate-800'
                      }`}
                    />
                    {hotseatPlayers.length > 2 && (
                      <button
                        onClick={() => {
                          setHotseatPlayers(hotseatPlayers.filter((_, i) => i !== idx));
                        }}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          darkMode ? 'text-slate-400 hover:text-red-400' : 'text-slate-400 hover:text-red-600'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                const preparedPlayers: Player[] = hotseatPlayers.map((p, idx) => ({
                  id: `hotseat_player_${idx}`,
                  name: p.name.trim() || `Player ${idx + 1}`,
                  initial: getFirstLetter(p.name.trim() || `Player ${idx + 1}`),
                  color: p.color,
                  score: 0,
                  isHost: idx === 0,
                  connected: true
                }));
                onStartPassAndPlay(preparedPlayers);
              }}
              className={`w-full py-3.5 font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer ${
                darkMode ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start Pass & Play Match</span>
            </button>
          </div>
        )}

        {/* 4C. SOLO VS AI BOTS */}
        {gameMode === 'vs_bots' && (
          <div className="space-y-3">
            <div className={`rounded-2xl p-3.5 border shadow-sm ${
              darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/90 border-paper-200'
            }`}>
              <span className={`text-xs font-bold uppercase tracking-wider block mb-2.5 ${
                darkMode ? 'text-slate-300' : 'text-slate-600'
              }`}>
                Number of AI Opponents
              </span>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(count => (
                  <button
                    key={count}
                    onClick={() => setBotCount(count)}
                    className={`py-2.5 rounded-xl border font-bold text-sm transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      botCount === count
                        ? darkMode
                          ? 'bg-amber-950/80 border-amber-600 text-amber-200 ring-1 ring-amber-400 shadow-sm'
                          : 'bg-amber-100 border-amber-400 text-slate-900 ring-1 ring-amber-400 shadow-sm'
                        : darkMode
                          ? 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-700'
                          : 'bg-paper-50 border-paper-200 text-slate-700 hover:bg-paper-100'
                    }`}
                  >
                    <Bot className={`w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} />
                    <span>{count} {count === 1 ? 'Bot' : 'Bots'}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => onStartVsBots(botCount)}
              className={`w-full py-3.5 font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer ${
                darkMode ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start Match vs AI</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
