import { GameState, Edge } from '../types/game';
import { getAdjacentCellIds, getCellEdgeIds } from './gameEngine';

/**
 * Evaluates the best move for a computer opponent.
 */
export function getBestBotMove(state: GameState): string | null {
  const unclaimedEdges: Edge[] = Object.values(state.edges).filter(e => !e.claimedBy);
  if (unclaimedEdges.length === 0) return null;

  // Helper to count how many edges of a cell are already claimed
  function getCellClaimedEdgesCount(cellId: string, testEdges: Record<string, Edge>): number {
    const cell = state.cells[cellId];
    if (!cell) return 0;
    const [top, bottom, left, right] = getCellEdgeIds(cell.r, cell.c);
    let count = 0;
    if (testEdges[top]?.claimedBy) count++;
    if (testEdges[bottom]?.claimedBy) count++;
    if (testEdges[left]?.claimedBy) count++;
    if (testEdges[right]?.claimedBy) count++;
    return count;
  }

  // 1. Check for immediate captures (boxes that currently have 3 sides completed)
  for (const edge of unclaimedEdges) {
    const adjCellIds = getAdjacentCellIds(edge, state.grid);
    for (const cellId of adjCellIds) {
      if (getCellClaimedEdgesCount(cellId, state.edges) === 3) {
        // Claiming this edge completes this box!
        return edge.id;
      }
    }
  }

  // 2. Safe moves: moves that will NOT give the next player an easy box (leaves count < 2)
  const safeEdges: Edge[] = [];
  for (const edge of unclaimedEdges) {
    const adjCellIds = getAdjacentCellIds(edge, state.grid);
    let createsThreeSidedBox = false;

    for (const cellId of adjCellIds) {
      const count = getCellClaimedEdgesCount(cellId, state.edges);
      // If the cell currently has 2 sides, claiming edge makes it 3 sides (giving opponent a capture!)
      if (count === 2) {
        createsThreeSidedBox = true;
        break;
      }
    }

    if (!createsThreeSidedBox) {
      safeEdges.push(edge);
    }
  }

  if (safeEdges.length > 0) {
    // Pick a random safe edge
    const randomIndex = Math.floor(Math.random() * safeEdges.length);
    return safeEdges[randomIndex].id;
  }

  // 3. Forced sacrifice: Pick the edge that damages the least (minimizes giving double boxes)
  let bestSacrificeEdge = unclaimedEdges[0];
  let minExposure = 999;

  for (const edge of unclaimedEdges) {
    const adjCellIds = getAdjacentCellIds(edge, state.grid);
    let exposure = 0;
    for (const cellId of adjCellIds) {
      if (getCellClaimedEdgesCount(cellId, state.edges) === 2) {
        exposure++;
      }
    }
    if (exposure < minExposure) {
      minExposure = exposure;
      bestSacrificeEdge = edge;
    }
  }

  return bestSacrificeEdge.id;
}
