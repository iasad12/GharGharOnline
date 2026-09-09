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

  const copyRoomLink = async () => {
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
      {/* Left: Logo badge & Grid info */}
      <div className="flex items-center gap-2 md:gap-3">
        <div className="flex items-center gap-1.5 cursor-pointer" onClick={onLeaveGame} title="Ghar Ghar">
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-sketch text-2xl font-bold shadow-sm ${
            darkMode ? 'bg-amber-950/60 border-amber-700 text-amber-400' : 'bg-amber-100 border-amber-300 text-amber-700'
          }`}>
            G
          </div>
          <div className={`hidden sm:flex items-center gap-1 text-[11px] font-mono ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <Grid className="w-3 h-3" />
            <span>{grid.dotCols}×{grid.dotRows}</span>
          </div>
        </div>
      </div>

      {/* Center: When in Room -> Room Code pill; otherwise -> active room discovery */}
      {isInRoom && roomCode && mode === 'multiplayer' ? (
        <div className={`flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1 rounded-full border shadow-sm ${
          darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-paper-200/80 border-paper-300'
        }`}>
          <span className={`text-xs font-semibold uppercase tracking-wider hidden sm:inline ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Room:</span>
          <span className={`text-xs sm:text-sm font-mono font-bold tracking-wider ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
            {roomCode}
          </span>
          <button
            onClick={copyRoomLink}
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
              : 'Click to view active online rooms'
          }
        >
          <Wifi className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span>
            {lanRooms.length === 1 ? '1 room found' : `${lanRooms.length} rooms found`}
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

        <button
          onClick={onLeaveGame}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl border transition-all ml-1 ${
            darkMode
              ? 'text-red-400 hover:text-red-300 hover:bg-red-950/40 border-red-900/50'
              : 'text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200'
          }`}
          title="Leave Game"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Exit</span>
        </button>
      </div>
    </header>
  );
};
