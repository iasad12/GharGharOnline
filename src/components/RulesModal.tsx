import React from 'react';
import { X, Trophy, Sparkles, CheckCircle2, RotateCcw } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode?: boolean;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose, darkMode = false }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl border-2 p-6 md:p-8 overflow-hidden transition-colors ${
        darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-paper-50 border-paper-300 text-slate-800'
      }`}>
        {/* Notebook header decoration */}
        <div className={`absolute top-0 left-0 right-0 h-3 ${darkMode ? 'bg-sky-500/40' : 'bg-red-500/30'}`}></div>
        <div className={`flex items-center justify-between pb-4 border-b ${darkMode ? 'border-slate-800' : 'border-paper-200'}`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <h2 className={`text-2xl font-bold font-sketch tracking-wide ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
              How to Play Ghar Ghar
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-paper-200'
            }`}
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`space-y-4 py-4 text-sm max-h-[70vh] overflow-y-auto pr-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
          <div className={`flex gap-3 items-start p-3 rounded-xl border shadow-sm ${
            darkMode ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white/70 border-paper-200'
          }`}>
            <div className={`p-2 rounded-lg shrink-0 ${darkMode ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-semibold mb-1 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>1. Take Turns Drawing Lines</h3>
              <p className={darkMode ? 'text-slate-300' : 'text-slate-600'}>
                Players take turns connecting two horizontally or vertically adjacent dots. Simply tap or click between any two dots to draw a pencil line.
              </p>
            </div>
          </div>

          <div className={`flex gap-3 items-start p-3 rounded-xl border shadow-sm ${
            darkMode ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white/70 border-paper-200'
          }`}>
            <div className={`p-2 rounded-lg shrink-0 ${darkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-semibold mb-1 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>2. Complete a Square to Claim a "Ghar"</h3>
              <p className={darkMode ? 'text-slate-300' : 'text-slate-600'}>
                Whoever places the 4th side to complete a $1 \times 1$ square claims that box as their home! Your first letter (e.g., <strong className={darkMode ? 'text-white' : 'text-slate-900'}>"A"</strong> for Asad) is permanently stamped inside with your ink color.
              </p>
            </div>
          </div>

          <div className={`flex gap-3 items-start p-3 rounded-xl border shadow-sm ${
            darkMode ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white/70 border-paper-200'
          }`}>
            <div className={`p-2 rounded-lg shrink-0 ${darkMode ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-semibold mb-1 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>3. Earn Bonus Turns!</h3>
              <p className={darkMode ? 'text-slate-300' : 'text-slate-600'}>
                Whenever you claim a Ghar, you immediately get an extra turn! A clever player can chain multiple home claims in a row by closing open boxes.
              </p>
            </div>
          </div>

          <div className={`flex gap-3 items-start p-3 rounded-xl border shadow-sm ${
            darkMode ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white/70 border-paper-200'
          }`}>
            <div className={`p-2 rounded-lg shrink-0 ${darkMode ? 'bg-purple-900/40 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-semibold mb-1 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>4. Win the Game</h3>
              <p className={darkMode ? 'text-slate-300' : 'text-slate-600'}>
                Once all squares on the grid are claimed, the game ends. The player with the most claimed homes is declared the Ghar Ghar Champion!
              </p>
            </div>
          </div>
        </div>

        <div className={`mt-4 pt-4 border-t flex justify-end ${darkMode ? 'border-slate-800' : 'border-paper-200'}`}>
          <button
            onClick={onClose}
            className={`px-6 py-2.5 font-semibold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer ${
              darkMode ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-slate-800 hover:bg-slate-900 text-white'
            }`}
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};
