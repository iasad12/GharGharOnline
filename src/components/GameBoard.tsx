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
  const boardRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panModeActive, setPanModeActive] = useState(false);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // Mobile / Touch dot-connection & line-steering state
  interface DotCoord {
    r: number;
    c: number;
  }
  const [dragOriginDot, setDragOriginDot] = useState<DotCoord | null>(null);
  const [dragTargetDot, setDragTargetDot] = useState<DotCoord | null>(null);
  const [dragPreviewEdgeId, setDragPreviewEdgeId] = useState<string | null>(null);
  const [selectedDot, setSelectedDot] = useState<DotCoord | null>(null);

  const dragOriginRef = useRef<DotCoord | null>(null);
  const dragEdgeIdRef = useRef<string | null>(null);
  const isTouchDraggingDotRef = useRef<boolean>(false);
  const dragMovedRef = useRef<boolean>(false);

  // Clear dragging state when turn switches
  useEffect(() => {
    setDragOriginDot(null);
    setDragTargetDot(null);
    setDragPreviewEdgeId(null);
    setSelectedDot(null);
    dragOriginRef.current = null;
    dragEdgeIdRef.current = null;
    isTouchDraggingDotRef.current = false;
    dragMovedRef.current = false;
  }, [currentTurnIndex, myPlayerId]);

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

  // Convert screen coordinates to board SVG coordinates
  const getBoardCoords = useCallback((clientX: number, clientY: number) => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const currentScale = rect.width / boardWidth;
    return {
      x: (clientX - rect.left) / currentScale,
      y: (clientY - rect.top) / currentScale
    };
  }, [boardWidth]);

  // Find nearest dot to board coordinates
  const findNearestDot = useCallback((x: number, y: number): { dot: DotCoord; dist: number } | null => {
    const c = Math.round((x - PADDING) / SPACING);
    const r = Math.round((y - PADDING) / SPACING);
    if (r >= 0 && r < grid.dotRows && c >= 0 && c < grid.dotCols) {
      const dotX = PADDING + c * SPACING;
      const dotY = PADDING + r * SPACING;
      const dist = Math.hypot(x - dotX, y - dotY);
      return { dot: { r, c }, dist };
    }
    return null;
  }, [grid.dotRows, grid.dotCols]);

  // Compute steered edge from origin dot based on drag vector
  const computeSteeredEdge = useCallback((origin: DotCoord, currX: number, currY: number): {
    edgeId: string | null;
    targetDot: DotCoord | null;
  } => {
    const originX = PADDING + origin.c * SPACING;
    const originY = PADDING + origin.r * SPACING;
    const dx = currX - originX;
    const dy = currY - originY;
    const dist = Math.hypot(dx, dy);

    // Deadzone: must drag at least 10 SVG units in a direction to preview
    if (dist < 10) {
      return { edgeId: null, targetDot: null };
    }

    let targetR = origin.r;
    let targetC = origin.c;
    let edgeId: string | null = null;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal direction (left/right)
      if (dx > 0 && origin.c < grid.dotCols - 1) {
        targetC = origin.c + 1;
        edgeId = `h_${origin.r}_${origin.c}`;
      } else if (dx < 0 && origin.c > 0) {
        targetC = origin.c - 1;
        edgeId = `h_${origin.r}_${origin.c - 1}`;
      }
    } else {
      // Vertical direction (up/down)
      if (dy > 0 && origin.r < grid.dotRows - 1) {
        targetR = origin.r + 1;
        edgeId = `v_${origin.r}_${origin.c}`;
      } else if (dy < 0 && origin.r > 0) {
        targetR = origin.r - 1;
        edgeId = `v_${origin.r - 1}_${origin.c}`;
      }
    }

    if (edgeId) {
      return { edgeId, targetDot: { r: targetR, c: targetC } };
    }
    return { edgeId: null, targetDot: null };
  }, [grid.dotRows, grid.dotCols]);

  // Dot tap handler (tap dot A then tap adjacent dot B)
  const handleDotTap = useCallback((r: number, c: number) => {
    if (!isMyTurn) return;

    if (!selectedDot) {
      setSelectedDot({ r, c });
      return;
    }

    if (selectedDot.r === r && selectedDot.c === c) {
      setSelectedDot(null);
      return;
    }

    // Check if adjacent
    let connectingEdgeId: string | null = null;
    if (selectedDot.r === r && Math.abs(selectedDot.c - c) === 1) {
      connectingEdgeId = `h_${r}_${Math.min(selectedDot.c, c)}`;
    } else if (selectedDot.c === c && Math.abs(selectedDot.r - r) === 1) {
      connectingEdgeId = `v_${Math.min(selectedDot.r, r)}_${c}`;
    }

    if (connectingEdgeId && edges[connectingEdgeId] && !edges[connectingEdgeId].claimedBy) {
      onSelectEdge(connectingEdgeId);
      setSelectedDot(null);
    } else {
      setSelectedDot({ r, c });
    }
  }, [isMyTurn, selectedDot, edges, onSelectEdge]);

  // Mouse Wheel Zoom
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

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || panModeActive || e.shiftKey) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    // Left click: check if initiating a dot drag
    if (e.button === 0 && isMyTurn) {
      const coords = getBoardCoords(e.clientX, e.clientY);
      if (coords) {
        const nearest = findNearestDot(coords.x, coords.y);
        if (nearest && nearest.dist <= SPACING * 0.44) {
          dragOriginRef.current = nearest.dot;
          isTouchDraggingDotRef.current = true;
          dragMovedRef.current = false;
          dragEdgeIdRef.current = null;
          setDragOriginDot(nearest.dot);
          setDragPreviewEdgeId(null);
          setDragTargetDot(null);
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      return;
    }

    if (isTouchDraggingDotRef.current && dragOriginRef.current && isMyTurn) {
      const coords = getBoardCoords(e.clientX, e.clientY);
      if (coords) {
        const steered = computeSteeredEdge(dragOriginRef.current, coords.x, coords.y);
        if (steered.edgeId) {
          dragMovedRef.current = true;
          if (edges[steered.edgeId] && !edges[steered.edgeId].claimedBy) {
            setDragPreviewEdgeId(steered.edgeId);
            setDragTargetDot(steered.targetDot);
            dragEdgeIdRef.current = steered.edgeId;
          } else {
            setDragPreviewEdgeId(null);
            setDragTargetDot(null);
            dragEdgeIdRef.current = null;
          }
        } else {
          setDragPreviewEdgeId(null);
          setDragTargetDot(null);
          dragEdgeIdRef.current = null;
        }
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);

    if (isTouchDraggingDotRef.current && dragOriginRef.current) {
      const origin = dragOriginRef.current;
      const finalEdgeId = dragEdgeIdRef.current;

      if (finalEdgeId && edges[finalEdgeId] && !edges[finalEdgeId].claimedBy && isMyTurn) {
        onSelectEdge(finalEdgeId);
        setSelectedDot(null);
      } else if (!dragMovedRef.current) {
        handleDotTap(origin.r, origin.c);
      }

      dragOriginRef.current = null;
      dragEdgeIdRef.current = null;
      isTouchDraggingDotRef.current = false;
      dragMovedRef.current = false;
      setDragOriginDot(null);
      setDragPreviewEdgeId(null);
      setDragTargetDot(null);
    }
  };

  // Touch Handlers for Mobile (Dot connection, directional drag preview, pinch-to-zoom & pan)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2-finger pinch start: cancel any active dot drag
      dragOriginRef.current = null;
      dragEdgeIdRef.current = null;
      isTouchDraggingDotRef.current = false;
      dragMovedRef.current = false;
      setDragOriginDot(null);
      setDragPreviewEdgeId(null);
      setDragTargetDot(null);

      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistanceRef.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) {
      if (panModeActive) {
        setIsDragging(true);
        setDragStart({
          x: e.touches[0].clientX - pan.x,
          y: e.touches[0].clientY - pan.y
        });
      } else if (isMyTurn) {
        const coords = getBoardCoords(e.touches[0].clientX, e.touches[0].clientY);
        if (coords) {
          const nearest = findNearestDot(coords.x, coords.y);
          if (nearest && nearest.dist <= SPACING * 0.45) {
            // Touched on or near a dot: initiate dot connection drag!
            dragOriginRef.current = nearest.dot;
            isTouchDraggingDotRef.current = true;
            dragMovedRef.current = false;
            dragEdgeIdRef.current = null;
            setDragOriginDot(nearest.dot);
            setDragPreviewEdgeId(null);
            setDragTargetDot(null);
          }
        }
      }
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
    } else if (e.touches.length === 1) {
      if (isDragging && panModeActive) {
        setPan({
          x: e.touches[0].clientX - dragStart.x,
          y: e.touches[0].clientY - dragStart.y
        });
      } else if (isTouchDraggingDotRef.current && dragOriginRef.current && isMyTurn) {
        const coords = getBoardCoords(e.touches[0].clientX, e.touches[0].clientY);
        if (coords) {
          const steered = computeSteeredEdge(dragOriginRef.current, coords.x, coords.y);
          if (steered.edgeId) {
            dragMovedRef.current = true;
            if (edges[steered.edgeId] && !edges[steered.edgeId].claimedBy) {
              setDragPreviewEdgeId(steered.edgeId);
              setDragTargetDot(steered.targetDot);
              dragEdgeIdRef.current = steered.edgeId;
            } else {
              setDragPreviewEdgeId(null);
              setDragTargetDot(null);
              dragEdgeIdRef.current = null;
            }
          } else {
            setDragPreviewEdgeId(null);
            setDragTargetDot(null);
            dragEdgeIdRef.current = null;
          }
        }
      }
    }
  };

  const handleTouchEnd = () => {
    touchDistanceRef.current = null;
    setIsDragging(false);

    if (isTouchDraggingDotRef.current && dragOriginRef.current) {
      const origin = dragOriginRef.current;
      const finalEdgeId = dragEdgeIdRef.current;

      if (finalEdgeId && edges[finalEdgeId] && !edges[finalEdgeId].claimedBy && isMyTurn) {
        // Drag connection completed!
        onSelectEdge(finalEdgeId);
        setSelectedDot(null);
      } else if (!dragMovedRef.current) {
        // Quick tap on a dot
        handleDotTap(origin.r, origin.c);
      }

      dragOriginRef.current = null;
      dragEdgeIdRef.current = null;
      isTouchDraggingDotRef.current = false;
      dragMovedRef.current = false;
      setDragOriginDot(null);
      setDragPreviewEdgeId(null);
      setDragTargetDot(null);
    }
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

  // Edge click handler (direct tap/click fallback)
  const handleEdgeClick = (edgeId: string) => {
    if (!isMyTurn) return;
    const edge = edges[edgeId];
    if (edge && !edge.claimedBy) {
      onSelectEdge(edgeId);
      setSelectedDot(null);
    }
  };

  // Candidate dots for tapped dot selection
  const candidateDots: DotCoord[] = [];
  if (selectedDot && isMyTurn) {
    const { r, c } = selectedDot;
    if (r > 0 && !edges[`v_${r - 1}_${c}`]?.claimedBy) candidateDots.push({ r: r - 1, c });
    if (r < grid.dotRows - 1 && !edges[`v_${r}_${c}`]?.claimedBy) candidateDots.push({ r: r + 1, c });
    if (c > 0 && !edges[`h_${r}_${c - 1}`]?.claimedBy) candidateDots.push({ r, c: c - 1 });
    if (c < grid.dotCols - 1 && !edges[`h_${r}_${c}`]?.claimedBy) candidateDots.push({ r, c: c + 1 });
  }

  const activeOriginDot = dragOriginDot || selectedDot;

  return (
    <div
      ref={containerRef}
      style={{ touchAction: 'none' }}
      className={`relative flex-1 w-full h-full overflow-hidden select-none paper-bg touch-none ${
        isDragging ? 'cursor-grabbing' : panModeActive ? 'cursor-grab' : 'cursor-default'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Mobile guidance tip */}
      {isMyTurn && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="py-1 px-3 rounded-full bg-paper-50/90 dark:bg-slate-900/90 backdrop-blur border border-paper-300 dark:border-slate-700 shadow-sm text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 animate-fade-in">
            <span
              className="w-2 h-2 rounded-full animate-pulse shrink-0"
              style={{ backgroundColor: activePlayer?.color || '#3b82f6' }}
            />
            <span>{selectedDot ? 'Tap adjacent dot to connect' : 'Drag from a dot in any direction to draw'}</span>
          </div>
        </div>
      )}

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
        ref={boardRef}
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
            const isSteered = dragPreviewEdgeId === edge.id && isMyTurn && !isClaimed;
            const isPreviewed = isHovered || isSteered;

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

                {/* 2B. Directional drag & hover preview */}
                {isPreviewed && (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={activePlayer?.color || '#3b82f6'}
                    strokeWidth={5.5}
                    strokeLinecap="round"
                    strokeOpacity={0.88}
                    strokeDasharray="6 3"
                    className="pointer-events-none"
                  >
                    <animate attributeName="stroke-dashoffset" from="0" to="18" dur="0.8s" repeatCount="indefinite" />
                  </line>
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

          {/* 3. DOTS (Grid points & interactive touch targets) */}
          {Array.from({ length: grid.dotRows }).map((_, r) =>
            Array.from({ length: grid.dotCols }).map((_, c) => {
              const cx = PADDING + c * SPACING;
              const cy = PADDING + r * SPACING;
              const isOrigin = activeOriginDot?.r === r && activeOriginDot?.c === c;
              const isTarget = dragTargetDot?.r === r && dragTargetDot?.c === c;
              const isCandidate = candidateDots.some(d => d.r === r && d.c === c);

              return (
                <g key={`dot_${r}_${c}`}>
                  {/* Candidate hint ring for tapped dot connection */}
                  {isCandidate && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={12}
                      fill="none"
                      stroke={activePlayer?.color || '#3b82f6'}
                      strokeWidth={1.8}
                      strokeDasharray="3 3"
                      opacity="0.85"
                      className="pointer-events-none"
                    >
                      <animate attributeName="stroke-dashoffset" from="0" to="12" dur="1.4s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Origin dot highlight (when touched or selected) */}
                  {isOrigin && (
                    <g className="pointer-events-none">
                      <circle
                        cx={cx}
                        cy={cy}
                        r={13.5}
                        fill={activePlayer?.color || '#3b82f6'}
                        fillOpacity={0.25}
                        stroke={activePlayer?.color || '#3b82f6'}
                        strokeWidth={2.5}
                      >
                        <animate attributeName="r" values="12;14.5;12" dur="1.8s" repeatCount="indefinite" />
                        <animate attributeName="fill-opacity" values="0.18;0.35;0.18" dur="1.8s" repeatCount="indefinite" />
                      </circle>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={7.5}
                        fill={activePlayer?.color || '#3b82f6'}
                      />
                    </g>
                  )}

                  {/* Target dot highlight: Authentic SVG radial beacon animation */}
                  {isTarget && (
                    <g className="pointer-events-none">
                      {/* Beacon wave 1: Radiating pulse ring */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={7}
                        fill="none"
                        stroke={activePlayer?.color || '#3b82f6'}
                        strokeWidth={2.5}
                      >
                        <animate attributeName="r" from="7" to="22" dur="1.2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="1" to="0" dur="1.2s" repeatCount="indefinite" />
                      </circle>

                      {/* Beacon wave 2: Soft filled sonar ripple offset by half-cycle */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={7}
                        fill={activePlayer?.color || '#3b82f6'}
                        stroke={activePlayer?.color || '#3b82f6'}
                        strokeWidth={1.5}
                      >
                        <animate attributeName="r" from="7" to="22" dur="1.2s" begin="0.6s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.85" to="0" dur="1.2s" begin="0.6s" repeatCount="indefinite" />
                        <animate attributeName="fill-opacity" from="0.3" to="0" dur="1.2s" begin="0.6s" repeatCount="indefinite" />
                      </circle>

                      {/* Prominent centered target dot */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={7.5}
                        fill={activePlayer?.color || '#3b82f6'}
                      />
                    </g>
                  )}

                  {/* Core visual Dot */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={5.5}
                    fill={darkMode ? '#e2e8f0' : '#334155'}
                    className="pointer-events-none transition-transform"
                  />
                  <circle
                    cx={cx - 1.2}
                    cy={cy - 1.2}
                    r={1.8}
                    fill="#94a3b8"
                    className="pointer-events-none"
                  />

                  {/* Generous touch & click hit circle */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={22}
                    fill="transparent"
                    className={isMyTurn ? 'cursor-pointer' : 'cursor-default'}
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
