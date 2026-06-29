import { KPuzzle, KPattern } from 'cubing/kpuzzle';

// BFS-based optimal cross solver.
// State: positions + orientations of 4 D-layer edges (DF, DR, DB, DL).
// Indices in EDGES orbit: DF=4, DR=5, DB=6, DL=7.
// State space: 12P4 * 2^4 = 190,080, max optimal depth = 8.

const CROSS_EDGE_INDICES = [4, 5, 6, 7]; // DF, DR, DB, DL in EDGES orbit

const MOVE_NAMES = [
  'R', "R'", 'R2',
  'L', "L'", 'L2',
  'U', "U'", 'U2',
  'D', "D'", 'D2',
  'F', "F'", 'F2',
  'B', "B'", 'B2',
];

// Face grouping for pruning (no two consecutive moves on the same face)
function moveFaceIndex(moveIndex: number): number {
  return Math.floor(moveIndex / 3);
}

// Encode cross-edge state as a unique integer key.
// We track where each of the 4 cross edges is and its orientation.
// For each edge: position (0-11) and orientation (0-1).
// Key = p0 + 12*(o0 + 2*(p1 + 12*(o1 + 2*(p2 + 12*(o2 + 2*(p3 + 12*o3))))))
function encodeState(pieces: number[], orientations: number[]): number {
  let key = 0;
  for (let i = 3; i >= 0; i--) {
    key = key * 24 + pieces[i] * 2 + orientations[i];
  }
  return key;
}

function extractCrossState(pattern: KPattern): { pieces: number[]; orientations: number[] } {
  const edgeData = pattern.patternData['EDGES'];
  const pieces: number[] = [];
  const orientations: number[] = [];

  // For each cross edge slot, find where it currently is
  for (const targetIdx of CROSS_EDGE_INDICES) {
    // Find where piece targetIdx currently sits
    const pos = edgeData.pieces.indexOf(targetIdx);
    pieces.push(pos);
    orientations.push(edgeData.orientation[pos]);
  }

  return { pieces, orientations };
}

interface BFSEntry {
  depth: number;
  parents: { lastMoveIndex: number; parentKey: number }[]; // all optimal-length paths
}

let bfsTable: Map<number, BFSEntry> | null = null;
let moveTransforms: { perm: number[]; orient: number[] }[][] | null = null;

// Pre-compute how each of the 18 moves transforms the edge orbit.
// cubing.js permutation convention: permutation[i] = source position for target position i.
// We need the inverse: given a piece at oldPos, find its newPos after the move.
// inversePerm[oldPos] = newPos, i.e., inversePerm[perm[i]] = i.
function buildMoveTransforms(kpuzzle: KPuzzle): void {
  moveTransforms = [];
  for (const moveName of MOVE_NAMES) {
    const transform = kpuzzle.moveToTransformation(moveName);
    const edgeTransform = transform.transformationData['EDGES'];
    const perm = Array.from(edgeTransform.permutation);
    const inversePerm = new Array(perm.length);
    for (let i = 0; i < perm.length; i++) {
      inversePerm[perm[i]] = i;
    }
    moveTransforms.push([{
      perm: inversePerm,
      orient: Array.from(edgeTransform.orientationDelta),
    }]);
  }
}

// Apply a move transform to a cross-edge state
function applyMoveToState(
  pieces: number[], orientations: number[],
  moveIdx: number
): { pieces: number[]; orientations: number[] } {
  const mt = moveTransforms![moveIdx][0];
  const newPieces: number[] = [];
  const newOrientations: number[] = [];

  for (let i = 0; i < 4; i++) {
    const oldPos = pieces[i];
    const newPos = mt.perm[oldPos]; // inversePerm: piece at oldPos goes to newPos
    newPieces.push(newPos);
    newOrientations.push((orientations[i] + mt.orient[newPos]) % 2); // delta at target position
  }

  return { pieces: newPieces, orientations: newOrientations };
}

export function initCrossSolver(kpuzzle: KPuzzle): void {
  if (bfsTable !== null) return;

  buildMoveTransforms(kpuzzle);

  // BFS from solved state outward
  const solvedPieces = CROSS_EDGE_INDICES.slice(); // [4, 5, 6, 7] - each in home position
  const solvedOrientations = [0, 0, 0, 0];
  const solvedKey = encodeState(solvedPieces, solvedOrientations);

  bfsTable = new Map();
  bfsTable.set(solvedKey, { depth: 0, parents: [] });

  const queue: { key: number; pieces: number[]; orientations: number[]; depth: number }[] = [
    { key: solvedKey, pieces: solvedPieces, orientations: solvedOrientations, depth: 0 }
  ];

  let head = 0;
  while (head < queue.length) {
    const { key: parentKey, pieces, orientations, depth } = queue[head++];
    const parentEntry = bfsTable.get(parentKey)!;

    // Collect last-move faces from ALL parent paths to prune correctly
    // For simplicity, we enumerate moves and check per-parent-path pruning
    // But since we store multiple parents, we need to allow a move if ANY parent path allows it
    for (let mi = 0; mi < 18; mi++) {
      const face = moveFaceIndex(mi);

      // Check if this move is valid for at least one parent path
      const validForSomePath = parentEntry.parents.length === 0 || parentEntry.parents.some(p => {
        const parentFace = moveFaceIndex(p.lastMoveIndex);
        if (face === parentFace) return false;
        if ((face ^ 1) === parentFace && face > parentFace) return false;
        return true;
      });
      if (!validForSomePath) continue;

      const { pieces: newPieces, orientations: newOrientations } = applyMoveToState(pieces, orientations, mi);
      const newKey = encodeState(newPieces, newOrientations);

      const existing = bfsTable.get(newKey);
      if (existing) {
        // Add another optimal path if same depth
        if (existing.depth === depth + 1) {
          existing.parents.push({ lastMoveIndex: mi, parentKey });
        }
        continue;
      }

      bfsTable.set(newKey, { depth: depth + 1, parents: [{ lastMoveIndex: mi, parentKey }] });
      queue.push({ key: newKey, pieces: newPieces, orientations: newOrientations, depth: depth + 1 });
    }
  }
}

export interface CrossSolution {
  moveCount: number;
  solution: string;
}

export function solveCross(pattern: KPattern): CrossSolution[] {
  if (!bfsTable) throw new Error('Cross solver not initialized. Call initCrossSolver() first.');

  const { pieces, orientations } = extractCrossState(pattern);
  const key = encodeState(pieces, orientations);
  const entry = bfsTable.get(key);

  if (!entry) {
    return [];
  }

  if (entry.depth === 0) {
    return [{ moveCount: 0, solution: '' }];
  }

  // Reconstruct all optimal paths via DFS through parent links
  const MAX_SOLUTIONS = 50;
  const allPaths: string[][] = [];

  function reconstruct(currentKey: number, pathSoFar: string[]) {
    if (allPaths.length >= MAX_SOLUTIONS) return;
    const e = bfsTable!.get(currentKey)!;
    if (e.parents.length === 0) {
      allPaths.push([...pathSoFar].map(invertHTMMove));
      return;
    }
    for (const parent of e.parents) {
      if (allPaths.length >= MAX_SOLUTIONS) return;
      pathSoFar.push(MOVE_NAMES[parent.lastMoveIndex]);
      reconstruct(parent.parentKey, pathSoFar);
      pathSoFar.pop();
    }
  }

  reconstruct(key, []);

  return allPaths.map(moves => ({
    moveCount: moves.length,
    solution: moves.join(' '),
  }));
}

function invertHTMMove(move: string): string {
  if (move.endsWith('2')) return move;
  if (move.endsWith("'")) return move.slice(0, -1);
  return move + "'";
}

// Generate a random scramble: 20 random face moves, no consecutive same-face
export function generateRandomScramble(): string {
  const moves: string[] = [];
  let lastFace = -1;

  for (let i = 0; i < 20; i++) {
    let mi: number;
    do {
      mi = Math.floor(Math.random() * 18);
    } while (moveFaceIndex(mi) === lastFace);
    lastFace = moveFaceIndex(mi);
    moves.push(MOVE_NAMES[mi]);
  }

  return moves.join(' ');
}
