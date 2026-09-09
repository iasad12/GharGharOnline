import React from 'react';
import { Player } from '../types/game';
import { Sparkles, Bot, WifiOff } from 'lucide-react';

interface PlayerBarProps {
  players: Player[];
  currentTurnIndex: number;
  myPlayerId: string | null;
  totalBoxes: number;
  bonusTurnAwarded: boolean;
  darkMode?: boolean;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  players,
  currentTurnIndex,
  myPlayerId,
  totalBoxes,
  bonusTurnAwarded,
  darkMode = false
}) => {
  const activePlayer = players[currentTurnIndex];
  const isMyTurn = myPlayerId ? activePlayer?.id === myPlayerId : true;

  return (
    <div className={`w-full border-b px-3 py-2 shrink-0 z-20 shadow-sm transition-colors duration-200 ${
      darkMode ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-paper-50/95 border-paper-200 text-slate-800'
    }`}>
      {/* Turn Banner */}
      <div className="flex items-center justify-between max-w-5xl mx-auto mb-1.5">
        <div className="flex items-center gap-2">
          {activePlayer && (
            <div 
              className="w-3 h-3 rounded-full animate-ping" 
              style={{ backgroundColor: activePlayer.color }}
            />
          )}
          <span className={`text-xs md:text-sm font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            {isMyTurn ? (
              <span className={`font-bold flex items-center gap-1.5 ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                <Sparkles className="w-4 h-4 text-emerald-500 animate-spin" />
                Your Turn! Draw a line
              </span>
            ) : (
              <span>
                <strong style={{ color: activePlayer?.color }}>{activePlayer?.name}</strong>'s turn to draw
              </span>
            )}
          </span>
        </div>

        {bonusTurnAwarded && (
          <div className={`flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full animate-bounce shadow-sm border ${
            darkMode ? 'bg-amber-950/80 text-amber-300 border-amber-700' : 'bg-amber-100 text-amber-800 border-amber-300'
          }`}>
            <Sparkles className={`w-3.5 h-3.5 ${darkMode ? 'text-amber-400' : 'text-amber-600'}`} />
            <span>Bonus Turn!</span>
          </div>
        )}
      </div>

      {/* Players List */}
      <div className="flex items-center gap-2.5 overflow-x-auto py-1.5 px-2 max-w-5xl mx-auto no-scrollbar">
        {players.map((player, idx) => {
          const isActive = idx === currentTurnIndex;
          const isMe = player.id === myPlayerId;
          const percentage = totalBoxes > 0 ? Math.round((player.score / totalBoxes) * 100) : 0;

          return (
            <div
              key={player.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all shrink-0 select-none m-0.5 ${
                isActive
                  ? darkMode
                    ? 'bg-slate-800 shadow-md border-slate-500 ring-2 ring-offset-1 ring-offset-slate-900'
                    : 'bg-white shadow-md border-slate-400 ring-2 ring-offset-1 ring-offset-white'
                  : darkMode
                    ? 'bg-slate-800/50 border-slate-700 opacity-80'
                    : 'bg-paper-100/80 border-paper-200 opacity-80'
              }`}
              style={{
                borderColor: isActive ? player.color : undefined,
                boxShadow: isActive ? `0 4px 12px ${player.color}35` : undefined
              }}
            >
              {/* Avatar Initial Badge */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-sketch text-xl font-bold text-white shadow-inner relative"
                style={{ backgroundColor: player.color }}
              >
                {player.initial}
                {player.isBot && (
                  <span className={`absolute -top-1 -right-1 text-white rounded-full p-0.5 ${darkMode ? 'bg-slate-900' : 'bg-slate-800'}`} title="AI Bot">
                    <Bot className="w-2.5 h-2.5" />
                  </span>
                )}
                {player.connected === false && (
                  <span className="absolute -bottom-1 -right-1 bg-red-600 text-white rounded-full p-0.5" title="Disconnected">
                    <WifiOff className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>

              {/* Player Details */}
              <div className="flex flex-col min-w-[70px]">
                <div className="flex items-center gap-1">
                  <span className={`text-xs font-bold truncate max-w-[90px] ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                    {player.name}
                  </span>
                  {isMe && (
                    <span className="text-[10px] font-semibold text-slate-400 font-mono">(You)</span>
                  )}
                </div>
                <div className={`flex items-center gap-1.5 text-[11px] font-mono ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{player.score}</span>
                  <span className="text-[10px]">homes</span>
                  <span className="text-slate-400">({percentage}%)</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
