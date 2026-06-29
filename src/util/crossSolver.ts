import { KPuzzle, KPattern } from 'cubing/kpuzzle';

// BFS-based optimal cross solver.
// State: positions + orientations of 4 cross edges for a given face.
// State space: 12P4 * 2^4 = 190,080, max optimal depth = 8.

// Edge orbit positions: UF=0, UR=1, UB=2, UL=3, DF=4, DR=5, DB=6, DL=7, FR=8, FL=9, BR=10, BL=11
const FACE_CROSS_EDGES: Record<string, number[]> = {
  D: [4, 5, 6, 7],
  U: [0, 1, 2, 3],
  F: [0, 8, 4, 9],
  B: [2, 10, 6, 11],
  R: [1, 5, 8, 10],
  L: [3, 7, 9, 11],
};

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
function encodeState(pieces: number[], orientations: number[]): number {
  let key = 0;
  for (let i = 3; i >= 0; i--) {
    key = key * 24 + pieces[i] * 2 + orientations[i];
  }
  return key;
}

function extractCrossState(pattern: KPattern, edgeIndices: number[]): { pieces: number[]; orientations: number[] } {
  const edgeData = pattern.patternData['EDGES'];
  const pieces: number[] = [];
  const orientations: number[] = [];

  for (const targetIdx of edgeIndices) {
    const pos = edgeData.pieces.indexOf(targetIdx);
    pieces.push(pos);
    orientations.push(edgeData.orientation[pos]);
  }

  return { pieces, orientations };
}

interface BFSEntry {
  depth: number;
  parents: { lastMoveIndex: number; parentKey: number }[];
}

const bfsTables = new Map<string, Map<number, BFSEntry>>();
let moveTransforms: { perm: number[]; orient: number[] }[][] | null = null;

// Pre-compute how each of the 18 moves transforms the edge orbit.
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

function applyMoveToState(
  pieces: number[], orientations: number[],
  moveIdx: number
): { pieces: number[]; orientations: number[] } {
  const mt = moveTransforms![moveIdx][0];
  const newPieces: number[] = [];
  const newOrientations: number[] = [];

  for (let i = 0; i < 4; i++) {
    const oldPos = pieces[i];
    const newPos = mt.perm[oldPos];
    newPieces.push(newPos);
    newOrientations.push((orientations[i] + mt.orient[newPos]) % 2);
  }

  return { pieces: newPieces, orientations: newOrientations };
}

function buildBFSTable(edgeIndices: number[]): Map<number, BFSEntry> {
  const solvedPieces = edgeIndices.slice();
  const solvedOrientations = [0, 0, 0, 0];
  const solvedKey = encodeState(solvedPieces, solvedOrientations);

  const table = new Map<number, BFSEntry>();
  table.set(solvedKey, { depth: 0, parents: [] });

  const queue: { key: number; pieces: number[]; orientations: number[]; depth: number }[] = [
    { key: solvedKey, pieces: solvedPieces, orientations: solvedOrientations, depth: 0 }
  ];

  let head = 0;
  while (head < queue.length) {
    const { key: parentKey, pieces, orientations, depth } = queue[head++];
    const parentEntry = table.get(parentKey)!;

    for (let mi = 0; mi < 18; mi++) {
      const face = moveFaceIndex(mi);

      const validForSomePath = parentEntry.parents.length === 0 || parentEntry.parents.some(p => {
        const parentFace = moveFaceIndex(p.lastMoveIndex);
        if (face === parentFace) return false;
        if ((face ^ 1) === parentFace && face > parentFace) return false;
        return true;
      });
      if (!validForSomePath) continue;

      const { pieces: newPieces, orientations: newOrientations } = applyMoveToState(pieces, orientations, mi);
      const newKey = encodeState(newPieces, newOrientations);

      const existing = table.get(newKey);
      if (existing) {
        if (existing.depth === depth + 1) {
          existing.parents.push({ lastMoveIndex: mi, parentKey });
        }
        continue;
      }

      table.set(newKey, { depth: depth + 1, parents: [{ lastMoveIndex: mi, parentKey }] });
      queue.push({ key: newKey, pieces: newPieces, orientations: newOrientations, depth: depth + 1 });
    }
  }

  return table;
}

export function initCrossSolver(kpuzzle: KPuzzle): void {
  if (moveTransforms !== null) return;
  buildMoveTransforms(kpuzzle);
  // Build D-cross table immediately (default)
  bfsTables.set('D', buildBFSTable(FACE_CROSS_EDGES['D']));
}

function ensureBFSTable(crossFace: string): Map<number, BFSEntry> {
  let table = bfsTables.get(crossFace);
  if (!table) {
    const edgeIndices = FACE_CROSS_EDGES[crossFace];
    if (!edgeIndices) throw new Error(`Unknown cross face: ${crossFace}`);
    table = buildBFSTable(edgeIndices);
    bfsTables.set(crossFace, table);
  }
  return table;
}

export interface CrossSolution {
  moveCount: number;
  solution: string;
}

export function solveCross(pattern: KPattern, crossFace: string = 'D'): CrossSolution[] {
  if (!moveTransforms) throw new Error('Cross solver not initialized. Call initCrossSolver() first.');

  const table = ensureBFSTable(crossFace);
  const edgeIndices = FACE_CROSS_EDGES[crossFace];
  const { pieces, orientations } = extractCrossState(pattern, edgeIndices);
  const key = encodeState(pieces, orientations);
  const entry = table.get(key);

  if (!entry) {
    return [];
  }

  if (entry.depth === 0) {
    return [{ moveCount: 0, solution: '' }];
  }

  const MAX_SOLUTIONS = 50;
  const allPaths: string[][] = [];

  function reconstruct(currentKey: number, pathSoFar: string[]) {
    if (allPaths.length >= MAX_SOLUTIONS) return;
    const e = table.get(currentKey)!;
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

// Face names indexed by moveFaceIndex
const FACE_NAMES = ['R', 'L', 'U', 'D', 'F', 'B'];

// Solve cross using only moves from a restricted set of faces.
export function solveGenRestricted(
  pattern: KPattern,
  allowedFaces: Set<number>,
  maxExtraMoves: number = 4,
  crossFace: string = 'D',
): CrossSolution | null {
  if (!moveTransforms) throw new Error('Cross solver not initialized.');

  const table = ensureBFSTable(crossFace);
  const edgeIndices = FACE_CROSS_EDGES[crossFace];
  const { pieces, orientations } = extractCrossState(pattern, edgeIndices);
  const startKey = encodeState(pieces, orientations);
  const startEntry = table.get(startKey);
  if (!startEntry) return null;
  if (startEntry.depth === 0) return { moveCount: 0, solution: '' };

  const maxDepth = Math.min(startEntry.depth + maxExtraMoves, 10);

  const allowedMoves: number[] = [];
  for (let mi = 0; mi < 18; mi++) {
    if (allowedFaces.has(moveFaceIndex(mi))) allowedMoves.push(mi);
  }

  let foundPath: string[] | null = null;

  function dfs(
    pcs: number[], oris: number[], depth: number, limit: number, lastFace: number,
    path: string[],
  ): boolean {
    const key = encodeState(pcs, oris);
    const entry = table.get(key);
    if (!entry) return false;
    if (entry.depth === 0) {
      foundPath = [...path];
      return true;
    }
    if (depth + entry.depth > limit) return false;

    for (const mi of allowedMoves) {
      const face = moveFaceIndex(mi);
      if (face === lastFace) continue;
      if ((face ^ 1) === lastFace && face > lastFace) continue;

      const { pieces: np, orientations: no } = applyMoveToState(pcs, oris, mi);
      path.push(MOVE_NAMES[mi]);
      if (dfs(np, no, depth + 1, limit, face, path)) return true;
      path.pop();
    }
    return false;
  }

  for (let limit = startEntry.depth; limit <= maxDepth; limit++) {
    if (dfs(pieces, orientations, 0, limit, -1, [])) {
      return {
        moveCount: foundPath!.length,
        solution: foundPath!.map(invertHTMMove).join(' '),
      };
    }
  }

  return null;
}

export function faceCharToIndex(face: string): number {
  return FACE_NAMES.indexOf(face);
}

function invertHTMMove(move: string): string {
  if (move.endsWith('2')) return move;
  if (move.endsWith("'")) return move.slice(0, -1);
  return move + "'";
}

function generateRandomMoves(numMoves: number): string {
  const moves: string[] = [];
  let lastFace = -1;

  for (let i = 0; i < numMoves; i++) {
    let mi: number;
    do {
      mi = Math.floor(Math.random() * 18);
    } while (moveFaceIndex(mi) === lastFace);
    lastFace = moveFaceIndex(mi);
    moves.push(MOVE_NAMES[mi]);
  }

  return moves.join(' ');
}

export function generateRandomScramble(): string {
  return generateRandomMoves(20);
}

export function generateScrambleFromState(
  currentPattern: KPattern,
  _kpuzzle?: KPuzzle,
  numMoves: number = 15,
): { scrambleMoves: string; targetPattern: KPattern; solutions: CrossSolution[] } {
  const scrambleMoves = generateRandomMoves(numMoves);
  const targetPattern = currentPattern.applyAlg(scrambleMoves);
  const solutions = solveCross(targetPattern);
  return { scrambleMoves, targetPattern, solutions };
}
