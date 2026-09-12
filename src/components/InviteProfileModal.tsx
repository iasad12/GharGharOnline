import React, { useState } from 'react';
import { PlayerColor } from '../types/game';
import { PLAYER_COLORS, getFirstLetter } from '../logic/gameEngine';
import { ClaimedHomeBadge } from './ClaimedHomeBadge';
import { Sparkles, ArrowRight, User } from 'lucide-react';

interface InviteProfileModalProps {
  roomCode: string;
  initialName?: string;
  initialColor?: PlayerColor;
  darkMode?: boolean;
  onConfirm: (name: string, color: PlayerColor) => void;
  onCancel: () => void;
}

export const InviteProfileModal: React.FC<InviteProfileModalProps> = ({
  roomCode,
  initialName = '',
  initialColor = PLAYER_COLORS[1], // Default to Blue for invited guests
  darkMode = false,
  onConfirm,
  onCancel
}) => {
  const [name, setName] = useState(
    initialName && initialName !== 'Player 1' && initialName !== 'Player 2' ? initialName : ''
  );
  const [color, setColor] = useState<PlayerColor>(initialColor);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a name to join.');
      return;
    }
    setError(null);
    onConfirm(trimmed, color);
  };

  const previewInitial = getFirstLetter(name.trim() || '?');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div
        className={`rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border-2 relative transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-paper-50 border-paper-300 text-slate-800'
        }`}
      >
        {/* Notebook top accent line */}
        <div
          className={`absolute top-0 left-0 right-0 h-3 rounded-t-3xl ${
            darkMode ? 'bg-sky-500/40' : 'bg-red-400/50'
          }`}
        />

        <div className="text-center mb-5 mt-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2 shadow-sm border bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Game Invitation</span>
          </div>
          <h2 className="text-2xl font-bold font-sketch">You're Invited to Play!</h2>
          <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Joining room <strong className="font-mono font-bold text-sm tracking-wider">{roomCode}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar & Badge Preview */}
          <div
            className={`p-4 rounded-2xl border flex items-center gap-4 ${
              darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/90 border-paper-200'
            }`}
          >
            <ClaimedHomeBadge
              initial={previewInitial}
              color={color}
              darkMode={darkMode}
              sizeClass="w-14 h-14"
              title="Your initial stamped inside claimed homes"
            />
            <div className="flex-1 min-w-0">
              <span className={`text-[11px] font-bold uppercase tracking-wider block mb-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Stamp Preview
              </span>
              <div className="text-sm font-bold truncate">
                {name.trim() || <span className="italic opacity-50">Enter name below</span>}
              </div>
              <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Initial <strong>"{previewInitial}"</strong> marks your claimed boxes.
              </p>
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
              darkMode ? 'text-slate-300' : 'text-slate-600'
            }`}>
              Your Name / Nickname
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className={`w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Asad, Yasir, Kamran..."
                maxLength={15}
                autoFocus
                className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border outline-none font-semibold text-sm transition-all ${
                  error
                    ? 'border-red-500 ring-2 ring-red-400/40'
                    : darkMode
                      ? 'border-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 text-slate-100 bg-slate-900/80'
                      : 'border-paper-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-400 text-slate-800 bg-paper-50/50'
                }`}
              />
            </div>
            {error && (
              <p className="text-xs text-red-500 mt-1 font-medium">{error}</p>
            )}
          </div>

          {/* Color Selection */}
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${
              darkMode ? 'text-slate-300' : 'text-slate-600'
            }`}>
              Choose Your Ink Color
            </label>
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl border bg-paper-100/50 dark:bg-slate-800/50 border-paper-200 dark:border-slate-700">
              {PLAYER_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-9 h-9 rounded-full transition-transform cursor-pointer relative flex items-center justify-center ${
                    color === c
                      ? darkMode
                        ? 'scale-115 ring-2 ring-offset-2 ring-sky-400 ring-offset-slate-900 shadow-md'
                        : 'scale-115 ring-2 ring-offset-2 ring-slate-800 ring-offset-white shadow-md'
                      : 'hover:scale-105 opacity-85 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                  title="Select ink color"
                >
                  {color === c && (
                    <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className={`py-3 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                darkMode
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-paper-300 text-slate-600 hover:bg-paper-100'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                name.trim()
                  ? darkMode
                    ? 'bg-sky-600 hover:bg-sky-500 text-white active:scale-98'
                    : 'bg-amber-600 hover:bg-amber-700 text-white active:scale-98'
                  : 'opacity-50 cursor-not-allowed bg-slate-400 text-white'
              }`}
            >
              <span>Join Game</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
