import { GridConfig, GameState, Player, Edge, Cell, PlayerColor } from '../types/game';

export const GRID_PRESETS: GridConfig[] = [
  { id: 'casual-4x4', label: 'Casual (4×4)', dotCols: 4, dotRows: 4 },
  { id: 'classic-portrait-5x8', label: 'Classic (5×8)', dotCols: 5, dotRows: 8, deviceTarget: 'phone' },
  { id: 'classic-6x6', label: 'Square (6×6)', dotCols: 6, dotRows: 6 },
  { id: 'medium-portrait-6x10', label: 'Medium (6×10)', dotCols: 6, dotRows: 10, deviceTarget: 'phone' },
  { id: 'medium-10x6', label: 'Medium (10×6)', dotCols: 10, dotRows: 6, deviceTarget: 'desktop' },
  { id: 'large-12x8', label: 'Large (12×8)', dotCols: 12, dotRows: 8, deviceTarget: 'desktop' },
  { id: 'epic-15x10', label: 'Epic (15×10)', dotCols: 15, dotRows: 10, deviceTarget: 'desktop' },
];

export const PLAYER_COLORS: PlayerColor[] = [
  '#ef4444', // Crimson Red
  '#3b82f6', // Ocean Blue
  '#10b981', // Emerald Green
  '#f59e0b', // Amber Orange
  '#8b5cf6', // Royal Purple
];

export function getFirstLetter(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

/**
 * Initializes empty edges and cells for a given grid configuration.
 */
export function initializeBoard(grid: GridConfig): {
  edges: Record<string, Edge>;
  cells: Record<string, Cell>;
  totalBoxes: number;
} {
  const edges: Record<string, Edge> = {};
  const cells: Record<string, Cell> = {};
  const { dotCols, dotRows } = grid;

  // Horizontal edges: dotRows rows of (dotCols - 1) edges
  for (let r = 0; r < dotRows; r++) {
    for (let c = 0; c < dotCols - 1; c++) {
      const id = `h_${r}_${c}`;
      edges[id] = {
        id,
        orientation: 'h',
        r,
        c,
        claimedBy: null
      };
    }
  }

  // Vertical edges: (dotRows - 1) rows of dotCols edges
  for (let r = 0; r < dotRows - 1; r++) {
    for (let c = 0; c < dotCols; c++) {
      const id = `v_${r}_${c}`;
      edges[id] = {
        id,
        orientation: 'v',
        r,
        c,
        claimedBy: null
      };
    }
  }

  // Cells: (dotRows - 1) rows of (dotCols - 1) cells
  const boxRows = dotRows - 1;
  const boxCols = dotCols - 1;
  for (let r = 0; r < boxRows; r++) {
    for (let c = 0; c < boxCols; c++) {
      const id = `cell_${r}_${c}`;
      cells[id] = {
        id,
        r,
        c,
        claimedBy: null
      };
    }
  }

  return {
    edges,
    cells,
    totalBoxes: boxRows * boxCols
  };
}

/**
 * Returns the cells adjacent to an edge.
 */
export function getAdjacentCellIds(edge: Edge, grid: GridConfig): string[] {
  const cellIds: string[] = [];
  const boxRows = grid.dotRows - 1;
  const boxCols = grid.dotCols - 1;

  if (edge.orientation === 'h') {
    // Horizontal edge at row r, col c
    // Cell above: r - 1, c (if r > 0)
    if (edge.r > 0 && edge.c < boxCols) {
      cellIds.push(`cell_${edge.r - 1}_${edge.c}`);
    }
    // Cell below: r, c (if r < boxRows)
    if (edge.r < boxRows && edge.c < boxCols) {
      cellIds.push(`cell_${edge.r}_${edge.c}`);
    }
  } else {
    // Vertical edge at row r, col c
    // Cell left: r, c - 1 (if c > 0)
    if (edge.c > 0 && edge.r < boxRows) {
      cellIds.push(`cell_${edge.r}_${edge.c - 1}`);
    }
    // Cell right: r, c (if c < boxCols)
    if (edge.c < boxCols && edge.r < boxRows) {
      cellIds.push(`cell_${edge.r}_${edge.c}`);
    }
  }

  return cellIds;
}

/**
 * Returns the 4 edge IDs bounding a cell (r, c).
 */
export function getCellEdgeIds(r: number, c: number): [string, string, string, string] {
  return [
    `h_${r}_${c}`,     // top
    `h_${r + 1}_${c}`, // bottom
    `v_${r}_${c}`,     // left
    `v_${r}_${c + 1}`  // right
  ];
}

/**
 * Applies a player's move to the game state.
 * Returns the updated game state and whether any boxes were claimed.
 */
export function applyMove(
  prevState: GameState,
  edgeId: string,
  playerId: string
): { nextState: GameState; newlyClaimedCells: Cell[] } {
  const edge = prevState.edges[edgeId];
  if (!edge || edge.claimedBy) {
    return { nextState: prevState, newlyClaimedCells: [] };
  }

  const playerIndex = prevState.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) {
    return { nextState: prevState, newlyClaimedCells: [] };
  }
  const player = prevState.players[playerIndex];

  // 1. Claim the edge
  const updatedEdges = {
    ...prevState.edges,
    [edgeId]: {
      ...edge,
      claimedBy: player.id,
      color: player.color
    }
  };

  // 2. Check adjacent cells for completion
  const adjacentCellIds = getAdjacentCellIds(edge, prevState.grid);
  const updatedCells = { ...prevState.cells };
  const newlyClaimedCells: Cell[] = [];

  for (const cellId of adjacentCellIds) {
    const cell = updatedCells[cellId];
    if (cell && !cell.claimedBy) {
      const [topId, bottomId, leftId, rightId] = getCellEdgeIds(cell.r, cell.c);
      const isTopClaimed = !!updatedEdges[topId]?.claimedBy;
      const isBottomClaimed = !!updatedEdges[bottomId]?.claimedBy;
      const isLeftClaimed = !!updatedEdges[leftId]?.claimedBy;
      const isRightClaimed = !!updatedEdges[rightId]?.claimedBy;

      if (isTopClaimed && isBottomClaimed && isLeftClaimed && isRightClaimed) {
        const claimedCell: Cell = {
          ...cell,
          claimedBy: player.id,
          initial: player.initial,
          color: player.color
        };
        updatedCells[cellId] = claimedCell;
        newlyClaimedCells.push(claimedCell);
      }
    }
  }

  const boxesClaimedCount = newlyClaimedCells.length;
  const newClaimedTotal = prevState.claimedBoxesCount + boxesClaimedCount;

  // 3. Update player scores
  const updatedPlayers = prevState.players.map((p, idx) => {
    if (idx === playerIndex) {
      return { ...p, score: p.score + boxesClaimedCount };
    }
    return p;
  });

  // 4. Determine next turn
  // If at least one box was claimed, the player keeps their turn!
  // Otherwise, turn passes to the next player.
  let nextTurnIndex = prevState.currentTurnIndex;
  let bonusTurn = false;

  if (boxesClaimedCount > 0) {
    bonusTurn = true;
  } else {
    // Pass turn to next connected player
    nextTurnIndex = (prevState.currentTurnIndex + 1) % updatedPlayers.length;
    // Skip disconnected players if any
    let attempts = 0;
    while (updatedPlayers[nextTurnIndex].connected === false && attempts < updatedPlayers.length) {
      nextTurnIndex = (nextTurnIndex + 1) % updatedPlayers.length;
      attempts++;
    }
  }

  // 5. Check Game Over
  const isGameOver = newClaimedTotal >= prevState.totalBoxes;
  let winners: string[] = [];

  if (isGameOver) {
    let maxScore = -1;
    for (const p of updatedPlayers) {
      if (p.score > maxScore) maxScore = p.score;
    }
    winners = updatedPlayers.filter(p => p.score === maxScore).map(p => p.id);
  }

  const nextState: GameState = {
    ...prevState,
    edges: updatedEdges,
    cells: updatedCells,
    players: updatedPlayers,
    claimedBoxesCount: newClaimedTotal,
    currentTurnIndex: nextTurnIndex,
    lastMoveEdgeId: edgeId,
    bonusTurnAwarded: bonusTurn,
    phase: isGameOver ? 'game_over' : 'playing',
    winnerIds: winners
  };

  return { nextState, newlyClaimedCells };
}

/**
 * Creates an initial fresh game state.
 */
export function createInitialGameState(grid: GridConfig, players: Player[]): GameState {
  const { edges, cells, totalBoxes } = initializeBoard(grid);
  return {
    grid,
    players,
    currentTurnIndex: 0,
    edges,
    cells,
    totalBoxes,
    claimedBoxesCount: 0,
    phase: 'lobby',
    lastMoveEdgeId: null,
    bonusTurnAwarded: false,
    winnerIds: []
  };
}
