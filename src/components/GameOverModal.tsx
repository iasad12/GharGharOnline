import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Home, Crown, Medal } from 'lucide-react';
import { Player } from '../types/game';
import { sound } from '../logic/audio';

interface GameOverModalProps {
  isOpen: boolean;
  players: Player[];
  totalBoxes: number;
  winnerIds: string[];
  isHost: boolean;
  onRematch: () => void;
  onBackToLobby: () => void;
  darkMode?: boolean;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  players,
  totalBoxes,
  winnerIds,
  isHost,
  onRematch,
  onBackToLobby,
  darkMode = false
}) => {
  useEffect(() => {
    if (isOpen) {
      sound.playVictory();
      // Multi-stage celebratory confetti
      const count = 200;
      const defaults = { origin: { y: 0.7 } };

      function fire(particleRatio: number, opts: confetti.Options) {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio)
        });
      }

      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Sort players by score descending
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const isTie = winnerIds.length > 1;
  const winners = players.filter(p => winnerIds.includes(p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className={`relative w-full max-w-md rounded-3xl shadow-2xl border-4 p-6 md:p-8 overflow-hidden text-center transition-colors ${
        darkMode ? 'bg-slate-900 border-amber-500/70 text-slate-100' : 'bg-paper-50 border-amber-300 text-slate-800'
      }`}>
        {/* Top ribbon */}
        <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400"></div>

        {/* Crown & Trophy icon */}
        <div className={`mx-auto w-20 h-20 rounded-2xl border-2 flex items-center justify-center mb-4 mt-2 shadow-inner relative ${
          darkMode ? 'bg-amber-950/40 border-amber-500/50' : 'bg-amber-100 border-amber-300'
        }`}>
          <Trophy className={`w-10 h-10 animate-pulse ${darkMode ? 'text-amber-400' : 'text-amber-600'}`} />
          <Crown className="w-6 h-6 text-amber-500 absolute -top-3 -right-2 transform rotate-12" />
        </div>

        {/* Title & Winner Name */}
        <h2 className={`text-3xl font-extrabold font-sketch mb-1 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
          {isTie ? "It's a Tie!" : "Game Finished!"}
        </h2>
        <p className={`text-sm mb-6 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
          {isTie ? (
            <span>Great match between champions!</span>
          ) : (
            <span>
              <strong className="text-lg font-bold" style={{ color: winners[0]?.color }}>
                {winners[0]?.name}
              </strong>{' '}
              claims victory with {winners[0]?.score} homes!
            </span>
          )}
        </p>

        {/* Scoreboard Rankings */}
        <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-1">
          {sortedPlayers.map((player, index) => {
            const isWinner = winnerIds.includes(player.id);
            const percentage = totalBoxes > 0 ? Math.round((player.score / totalBoxes) * 100) : 0;

            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  isWinner
                    ? darkMode
                      ? 'bg-amber-950/30 border-amber-500/60 shadow-md ring-2 ring-amber-500/40'
                      : 'bg-amber-50 border-amber-300 shadow-md ring-2 ring-amber-300/60'
                    : darkMode
                      ? 'bg-slate-800/80 border-slate-700/60'
                      : 'bg-white/80 border-paper-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-6 font-bold text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {index === 0 ? (
                      <Crown className="w-5 h-5 text-amber-500" />
                    ) : index === 1 ? (
                      <Medal className="w-5 h-5 text-slate-400" />
                    ) : (
                      `#${index + 1}`
                    )}
                  </div>
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-sketch text-2xl font-bold text-white shadow-inner"
                    style={{ backgroundColor: player.color }}
                  >
                    {player.initial}
                  </div>
                  <div className="text-left">
                    <div className={`font-bold text-sm ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{player.name}</div>
                    <div className={`text-[11px] font-mono ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {percentage}% of the board
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-xl font-extrabold font-mono ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                    {player.score}
                  </span>
                  <span className={`text-xs ml-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>homes</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onRematch}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer ${
              darkMode ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>{isHost ? 'Play Rematch' : 'Request Rematch'}</span>
          </button>
          <button
            onClick={onBackToLobby}
            className={`flex items-center justify-center gap-1.5 py-3 px-4 font-semibold rounded-xl transition-all active:scale-95 cursor-pointer ${
              darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-paper-200 hover:bg-paper-300 text-slate-700'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Lobby</span>
          </button>
        </div>
      </div>
    </div>
  );
};
