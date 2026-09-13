import React, { useState } from 'react';
import { Volume2, VolumeX, HelpCircle, LogOut, Copy, Check, QrCode, Grid, Sun, Moon, Wifi } from 'lucide-react';
import { sound } from '../logic/audio';
import { GameMode, GridConfig, LanRoomInfo } from '../types/game';
import { copyToClipboard } from '../logic/clipboard';

interface HeaderProps {
  roomCode: string | null;
  mode: GameMode;
  grid: GridConfig;
  darkMode: boolean;
  isInRoom: boolean;
  showExit?: boolean;
  lanRooms?: LanRoomInfo[];
  onJoinLanRoom?: (roomId: string) => void;
  onToggleDarkMode: () => void;
  onOpenRules: () => void;
  onOpenQr?: () => void;
  onLeaveGame: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  roomCode,
  mode,
  grid,
  darkMode,
  isInRoom,
  showExit = isInRoom,
  lanRooms = [],
  onJoinLanRoom,
  onToggleDarkMode,
  onOpenRules,
  onOpenQr,
  onLeaveGame
}) => {
  const [muted, setMuted] = useState(sound.getMuted());
  const [copied, setCopied] = useState(false);

  const toggleSound = () => {
    const isMute = sound.toggleMute();
    setMuted(isMute);
  };

  const copyLobbyLink = async () => {
    if (!roomCode) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    const success = await copyToClipboard(url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const totalHomes = (grid.dotCols - 1) * (grid.dotRows - 1);

  return (
    <header className={`h-14 px-3 md:px-6 backdrop-blur border-b flex items-center justify-between z-30 shrink-0 select-none transition-colors duration-200 ${
      darkMode ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-paper-50/95 border-paper-200 text-slate-800'
    }`}>
      {/* Left: Logo badge & Title */}
      <div className="flex items-center gap-1.5 md:gap-2.5">
        <div className={`flex items-center gap-1.5 ${showExit ? 'cursor-pointer' : ''}`} onClick={showExit ? onLeaveGame : undefined} title="Ghar Ghar">
          <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 select-none flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-8 h-8 sm:w-9 sm:h-9 drop-shadow-sm">
              {/* Claimed home background fill & connecting lines */}
              <rect
                x="18"
                y="18"
                width="64"
                height="64"
                rx="10"
                fill={darkMode ? 'rgba(239, 68, 68, 0.22)' : '#fee2e2'}
                stroke={darkMode ? '#f87171' : '#ef4444'}
                strokeWidth="7"
                strokeLinecap="round"
              />
              {/* 4 corner dots of claimed home */}
              <circle cx="18" cy="18" r="8" fill={darkMode ? '#e2e8f0' : '#1e293b'} />
              <circle cx="82" cy="18" r="8" fill={darkMode ? '#e2e8f0' : '#1e293b'} />
              <circle cx="18" cy="82" r="8" fill={darkMode ? '#e2e8f0' : '#1e293b'} />
              <circle cx="82" cy="82" r="8" fill={darkMode ? '#e2e8f0' : '#1e293b'} />
              {/* Authentic Caveat 'G' */}
              <path
                d="M41.6 65.1Q40.4 64.3 39.8 62.7Q39.2 61.1 39.2 59.7Q39.2 57.1 39.7 54.2Q40.2 51.4 41.0 49.0Q41.5 47.5 42.2 45.9Q42.8 44.3 43.5 42.9Q44.2 41.5 44.8 40.5Q46.1 38.2 47.5 36.9Q48.9 35.5 49.6 35.1Q50.8 34.5 52.5 34.2Q54.1 33.8 55.7 34.2Q56.8 34.5 57.9 35.0Q59.0 35.6 59.8 36.4Q60.3 36.8 60.5 37.3Q60.8 37.8 60.8 38.3Q60.8 38.9 60.2 39.5Q59.6 40.1 58.9 40.3Q58.1 40.5 57.8 40.1Q57.2 39.2 56.7 38.8Q56.2 38.3 55.6 38.1Q55.2 37.8 54.4 37.8Q53.6 37.8 52.7 38.1Q51.8 38.4 51.0 39.0Q50.7 39.3 50.2 39.8Q49.7 40.2 49.2 40.9Q48.6 41.5 48.2 42.3Q47.0 44.3 46.2 46.3Q45.4 48.3 44.7 50.7Q44.4 51.7 44.1 53.1Q43.7 54.5 43.5 56.0Q43.2 57.4 43.1 58.4Q43.0 59.9 43.2 60.8Q43.4 61.6 44.1 61.9Q44.8 62.2 46.0 61.9Q47.1 61.6 48.2 61.0Q49.4 60.4 50.4 59.4Q51.5 58.5 52.3 57.1Q53.1 55.7 53.6 54.5Q54.1 53.3 54.1 52.6Q54.1 51.9 53.4 51.9Q51.6 52.0 50.6 51.8Q49.5 51.6 49.1 51.0Q48.6 50.8 48.6 50.0Q48.6 49.2 49.4 48.7Q50.1 48.3 51.4 48.2Q52.6 48.2 54.0 48.3Q55.3 48.5 56.1 48.9Q57.1 49.4 57.4 50.3Q57.8 51.2 57.8 52.2Q57.8 53.3 57.7 54.2Q57.3 55.7 56.6 57.1Q56.0 58.5 54.9 59.9Q54.2 60.8 53.1 61.8Q52.0 62.8 50.8 63.6Q49.6 64.3 48.5 64.8Q46.8 65.6 45.0 65.9Q43.1 66.3 41.6 65.1Z"
                fill={darkMode ? '#fca5a5' : '#dc2626'}
              />
            </svg>
          </div>
          {!isInRoom ? (
            <div className="flex items-center select-none">
              <span className={`font-sketch font-bold text-lg tracking-wide ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                2(Ghar)
              </span>
            </div>
          ) : (
            <div className={`hidden sm:flex items-center gap-1 text-[11px] font-mono ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <Grid className="w-3 h-3" />
              <span>{grid.dotCols}×{grid.dotRows}</span>
            </div>
          )}
        </div>
      </div>

      {/* Center: When in Lobby -> Lobby Code pill; otherwise -> active lobby discovery */}
      {isInRoom && roomCode && mode === 'multiplayer' ? (
        <div className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1 rounded-full border shadow-sm shrink-0 ${
          darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-paper-200/80 border-paper-300'
        }`}>
          <span className={`text-xs font-semibold uppercase tracking-wider hidden sm:inline ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Lobby:</span>
          <span className={`text-xs sm:text-sm font-mono font-bold tracking-wider whitespace-nowrap ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
            {roomCode}
          </span>
          <button
            onClick={copyLobbyLink}
            className={`p-1 rounded-md transition-colors ${darkMode ? 'text-slate-300 hover:text-white hover:bg-slate-700' : 'text-slate-600 hover:text-slate-900 hover:bg-paper-300/50'}`}
            title="Copy Invite Link"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {onOpenQr && (
            <button
              onClick={onOpenQr}
              className={`p-1 rounded-md transition-colors ${darkMode ? 'text-slate-300 hover:text-white hover:bg-slate-700' : 'text-slate-600 hover:text-slate-900 hover:bg-paper-300/50'}`}
              title="Show QR Code for Mobile"
            >
              <QrCode className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : !isInRoom && lanRooms.length > 0 ? (
        <button
          onClick={() => {
            if (lanRooms.length === 1) {
              onJoinLanRoom?.(lanRooms[0].roomId);
            } else {
              const el = document.getElementById('nearby-lan-games');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1 rounded-full border shadow-sm text-xs font-bold transition-all cursor-pointer active:scale-95 animate-fade-in ${
            darkMode
              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300 hover:bg-emerald-900/80'
              : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
          }`}
          title={
            lanRooms.length === 1
              ? `Click to join ${lanRooms[0].hostName}'s game (${lanRooms[0].roomId})`
              : 'Click to view active online lobbies'
          }
        >
          <Wifi className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span>
            {lanRooms.length === 1 ? '1 lobby found' : `${lanRooms.length} lobbies found`}
          </span>
          {lanRooms.length === 1 ? (
            <span className={`text-[10px] uppercase font-mono px-1 py-0.2 rounded font-bold ${
              darkMode ? 'bg-emerald-800 text-emerald-200' : 'bg-emerald-200 text-emerald-900'
            }`}>
              Join
            </span>
          ) : (
            <span className={`text-[10px] font-semibold ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
              ↓ View
            </span>
          )}
        </button>
      ) : null}

      {/* Right: DarkMode segmented toggle, Sound, Rules, Exit */}
      <div className="flex items-center gap-1 md:gap-2">
        {/* Unambiguous 2-way Theme Switch */}
        <div className={`flex items-center p-0.5 rounded-xl border transition-all ${
          darkMode ? 'bg-slate-800 border-slate-700' : 'bg-paper-200/90 border-paper-300'
        }`}>
          <button
            onClick={() => darkMode && onToggleDarkMode()}
            className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              !darkMode
                ? 'bg-white text-amber-800 shadow-sm border border-paper-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Switch to Light Paper Theme"
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Light</span>
          </button>
          <button
            onClick={() => !darkMode && onToggleDarkMode()}
            className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              darkMode
                ? 'bg-slate-700 text-sky-300 shadow-sm border border-slate-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Switch to Dark Chalkboard Theme"
          >
            <Moon className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Dark</span>
          </button>
        </div>

        <button
          onClick={toggleSound}
          className={`p-1.5 md:p-2 rounded-xl transition-all ${
            darkMode ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-paper-200/80'
          }`}
          title={muted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {muted ? <VolumeX className="w-4 h-4 md:w-5 md:h-5 text-red-500" /> : <Volume2 className="w-4 h-4 md:w-5 md:h-5" />}
        </button>

        <button
          onClick={onOpenRules}
          className={`p-1.5 md:p-2 rounded-xl transition-all ${
            darkMode ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-paper-200/80'
          }`}
          title="Game Rules"
        >
          <HelpCircle className="w-4 h-4 md:w-5 md:h-5" />
        </button>

        {showExit && (
          <button
            onClick={onLeaveGame}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-xl border transition-all ml-0.5 sm:ml-1 ${
              darkMode
                ? 'text-red-400 hover:text-red-300 hover:bg-red-950/40 border-red-900/50'
                : 'text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200'
            }`}
            title="Leave Game / Exit"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        )}
      </div>
    </header>
  );
};
