import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GameState, Player, EdgeOrientation } from '../types/game';
import { ZoomIn, ZoomOut, Maximize2, Move, Mic } from 'lucide-react';
import { sound } from '../logic/audio';

interface GameBoardProps {
  state: GameState;
  myPlayerId: string | null;
  darkMode?: boolean;
  onSelectEdge: (edgeId: string) => void;
  enableVoiceChat?: boolean;
  isTalking?: boolean;
  onStartTalking?: () => void;
  onStopTalking?: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  state,
  myPlayerId,
  darkMode = false,
  onSelectEdge,
  enableVoiceChat = false,
  isTalking = false,
  onStartTalking,
  onStopTalking
}) => {
  const { grid, edges, cells, currentTurnIndex, players } = state;
  const activePlayer = players[currentTurnIndex];
  const isMyTurn = myPlayerId ? activePlayer?.id === myPlayerId : true;

  // Geometry dimensions
  const SPACING = 60;
  const PADDING = 40;
  const boardWidth = (grid.dotCols - 1) * SPACING + PADDING * 2;
  const boardHeight = (grid.dotRows - 1) * SPACING + PADDING * 2;

  // Container & Pan/Zoom state
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panModeActive, setPanModeActive] = useState(false);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // Multi-touch pinch tracking
  const touchDistanceRef = useRef<number | null>(null);

  // Auto-fit initial board to screen
  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    // Leave comfortable margin
    const scaleX = (clientWidth - 40) / boardWidth;
    const scaleY = (clientHeight - 40) / boardHeight;
    const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.6);

    const newPanX = (clientWidth - boardWidth * newScale) / 2;
    const newPanY = (clientHeight - boardHeight * newScale) / 2;

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  }, [boardWidth, boardHeight]);

  useEffect(() => {
    fitToScreen();
    window.addEventListener('resize', fitToScreen);
    return () => window.removeEventListener('resize', fitToScreen);
  }, [fitToScreen]);

  // Zoom controls
  const handleZoom = (delta: number) => {
    setScale(prev => Math.min(Math.max(prev + delta, 0.35), 3.0));
  };

  // Mouse Wheel Zoom (non-passive listener to allow preventDefault safely)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 0.12 : -0.12;
      setScale(prev => Math.min(Math.max(prev + zoomFactor, 0.35), 3.0));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Mouse Drag to Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag with middle click or if pan mode is toggled, or if space pressed
    if (e.button === 1 || panModeActive || e.shiftKey) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Handlers for Mobile (Pinch-to-zoom & 2-finger pan)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistanceRef.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1 && panModeActive) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDistance = Math.hypot(dx, dy);
      const ratio = currentDistance / touchDistanceRef.current;
      setScale(prev => Math.min(Math.max(prev * ratio, 0.35), 3.0));
      touchDistanceRef.current = currentDistance;
    } else if (e.touches.length === 1 && isDragging && panModeActive) {
      setPan({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    touchDistanceRef.current = null;
    setIsDragging(false);
  };

  // Push-to-Talk Keyboard Shortcut ('K' / 'k')
  useEffect(() => {
    if (!enableVoiceChat || !onStartTalking || !onStopTalking) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key.toLowerCase() === 'k' && !e.repeat) {
        onStartTalking();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k') {
        onStopTalking();
      }
    };

    const handleBlur = () => {
      onStopTalking();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enableVoiceChat, onStartTalking, onStopTalking]);

  // Edge click handler
  const handleEdgeClick = (edgeId: string) => {
    if (!isMyTurn) return;
    const edge = edges[edgeId];
    if (edge && !edge.claimedBy) {
      onSelectEdge(edgeId);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 w-full h-full overflow-hidden select-none paper-bg ${
        isDragging ? 'cursor-grabbing' : panModeActive ? 'cursor-grab' : 'cursor-default'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Floating Viewport Controls (Bottom Right) */}
      <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1.5 bg-paper-50/95 dark:bg-slate-900/95 backdrop-blur p-1.5 rounded-2xl shadow-lg border border-paper-300 dark:border-slate-700">
        {enableVoiceChat && onStartTalking && onStopTalking && (
          <>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                onStartTalking();
              }}
              onMouseUp={(e) => {
                e.preventDefault();
                onStopTalking();
              }}
              onMouseLeave={() => {
                if (isTalking) onStopTalking();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                onStartTalking();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                onStopTalking();
              }}
              onTouchCancel={() => {
                if (isTalking) onStopTalking();
              }}
              className={`p-2 rounded-xl transition-all active:scale-95 cursor-pointer select-none flex items-center gap-1.5 ${
                isTalking
                  ? 'bg-emerald-600 text-white ring-4 ring-emerald-400/50 shadow-lg shadow-emerald-500/40 animate-pulse'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-paper-200 dark:hover:bg-slate-800'
              }`}
              title={isTalking ? 'Transmitting audio! Release to mute' : 'Push to Talk (Hold K or Press & Hold)'}
            >
              <Mic className={`w-5 h-5 ${isTalking ? 'text-white animate-bounce' : ''}`} />
              <span className="text-[10px] font-bold font-mono px-1 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hidden sm:inline">
                {isTalking ? 'TALKING' : 'K'}
              </span>
            </button>
            <div className="h-5 w-px bg-paper-300 dark:bg-slate-700 mx-0.5" />
          </>
        )}
        <button
          onClick={() => handleZoom(0.15)}
          className="p-2 text-slate-700 dark:text-slate-200 hover:bg-paper-200 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-95"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={() => handleZoom(-0.15)}
          className="p-2 text-slate-700 dark:text-slate-200 hover:bg-paper-200 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-95"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={fitToScreen}
          className="p-2 text-slate-700 dark:text-slate-200 hover:bg-paper-200 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-95"
          title="Fit to Screen"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => setPanModeActive(!panModeActive)}
          className={`p-2 rounded-xl transition-all active:scale-95 ${
            panModeActive
              ? 'bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400'
              : 'text-slate-700 dark:text-slate-200 hover:bg-paper-200 dark:hover:bg-slate-800'
          }`}
          title={panModeActive ? 'Pan Mode Active (Drag to Pan)' : 'Enable Pan Mode'}
        >
          <Move className="w-5 h-5" />
        </button>
      </div>

      {/* SVG Canvas Board */}
      <div
        className="absolute origin-top-left board-viewport"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          width: boardWidth,
          height: boardHeight
        }}
      >
        <svg
          width={boardWidth}
          height={boardHeight}
          className="overflow-visible"
        >
          <defs>
            {/* Filter for hand-drawn / stamped pencil look */}
            <filter id="pencil-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="1" dy="1.5" stdDeviation="1.2" floodColor="#334155" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* 1. CLAIMED CELLS ("GHAR" HOMES) */}
          {Object.values(cells).map(cell => {
            const x = PADDING + cell.c * SPACING;
            const y = PADDING + cell.r * SPACING;
            const isClaimed = !!cell.claimedBy;

            return (
              <g key={cell.id} className={isClaimed ? 'animate-claim' : ''}>
                {isClaimed && (
                  <>
                    {/* Shaded box background */}
                    <rect
                      x={x + 3}
                      y={y + 3}
                      width={SPACING - 6}
                      height={SPACING - 6}
                      rx={8}
                      fill={cell.color || '#3b82f6'}
                      fillOpacity={0.22}
                      stroke={cell.color || '#3b82f6'}
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                    />
                    {/* Stamped initial of player name with optical centering for cursive slant */}
                    <text
                      x={x + SPACING / 2 - (cell.initial && cell.initial.length > 1 ? 2.8 : 3.6)}
                      y={y + SPACING / 2 + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={cell.color || '#1e293b'}
                      fontFamily="'Caveat', cursive, sans-serif"
                      fontSize={cell.initial && cell.initial.length > 1 ? SPACING * 0.56 : SPACING * 0.68}
                      fontWeight="bold"
                      filter="url(#pencil-shadow)"
                      className="select-none pointer-events-none"
                    >
                      {cell.initial}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* 2. EDGES (Lines between dots) */}
          {Object.values(edges).map(edge => {
            const isHorizontal = edge.orientation === 'h';
            const isClaimed = !!edge.claimedBy;
            const isHovered = hoveredEdgeId === edge.id && isMyTurn && !isClaimed;

            // Compute coordinates
            const x1 = PADDING + edge.c * SPACING;
            const y1 = PADDING + edge.r * SPACING;
            const x2 = isHorizontal ? x1 + SPACING : x1;
            const y2 = isHorizontal ? y1 : y1 + SPACING;

            return (
              <g
                key={edge.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdgeClick(edge.id);
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onMouseEnter={() => setHoveredEdgeId(edge.id)}
                onMouseLeave={() => setHoveredEdgeId(null)}
                className={isClaimed ? '' : isMyTurn ? 'cursor-pointer' : 'cursor-not-allowed'}
              >
                {/* 2A. Faint guide dot-to-dot line when unclaimed */}
                {!isClaimed && (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={darkMode ? '#334155' : '#cbd5e1'}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    className="pointer-events-none"
                  />
                )}

                {/* 2B. Hover preview when active player mouses over */}
                {isHovered && (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={activePlayer?.color || '#3b82f6'}
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeOpacity={0.75}
                    strokeDasharray="6 3"
                    className="pointer-events-none animate-pulse"
                  />
                )}

                {/* 2C. Claimed Line (Bold, vibrant, highly visible ink line) */}
                {isClaimed && (
                  <>
                    {/* Shadow under line */}
                    <line
                      x1={x1}
                      y1={y1 + 1}
                      x2={x2}
                      y2={y2 + 1}
                      stroke={darkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.15)'}
                      strokeWidth={6}
                      strokeLinecap="round"
                      className="pointer-events-none"
                    />
                    {/* Main ink line */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={edge.color || (darkMode ? '#38bdf8' : '#1e293b')}
                      strokeWidth={5.5}
                      strokeLinecap="round"
                      className="pointer-events-none transition-all duration-200"
                    />
                  </>
                )}

                {/* 2D. Generous invisible hit-box for reliable thumb touch & mouse click */}
                {!isClaimed && (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgba(0,0,0,0.001)"
                    strokeWidth={38}
                    strokeLinecap="round"
                    style={{ pointerEvents: 'stroke' }}
                  />
                )}
              </g>
            );
          })}

          {/* 3. DOTS (Grid points) */}
          {Array.from({ length: grid.dotRows }).map((_, r) =>
            Array.from({ length: grid.dotCols }).map((_, c) => {
              const cx = PADDING + c * SPACING;
              const cy = PADDING + r * SPACING;

              return (
                <g key={`dot_${r}_${c}`} className="pointer-events-none">
                  <circle
                    cx={cx}
                    cy={cy}
                    r={5.5}
                    fill={darkMode ? '#e2e8f0' : '#334155'}
                    className="transition-transform"
                  />
                  <circle
                    cx={cx - 1.2}
                    cy={cy - 1.2}
                    r={1.8}
                    fill={darkMode ? '#94a3b8' : '#94a3b8'}
                  />
                </g>
              );
            })
          )}
        </svg>
      </div>
    </div>
  );
};
