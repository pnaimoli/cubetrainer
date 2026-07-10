import { KPuzzle, KPattern } from 'cubing/kpuzzle';
import { crossDepthFromEdgeState, initCrossSolver } from './crossSolver';

// IDA*-based XCross solver.
// Solves cross + one F2L corner+edge pair simultaneously.
// Uses cross BFS depth as an admissible heuristic.

// Edge orbit positions: UF=0, UR=1, UB=2, UL=3, DF=4, DR=5, DB=6, DL=7, FR=8, FL=9, BR=10, BL=11
// Corner orbit positions: UFR=0, URB=1, UBL=2, ULF=3, DRF=4, DFL=5, DLB=6, DBR=7

const FACE_CROSS_EDGES: Record<string, number[]> = {
  D: [4, 5, 6, 7],
  U: [0, 1, 2, 3],
  F: [0, 8, 4, 9],
  B: [2, 10, 6, 11],
  R: [1, 5, 8, 10],
  L: [3, 7, 9, 11],
};

// F2L slot definitions: { slotName: [edgeIndex, cornerIndex] }
const FACE_F2L_SLOTS: Record<string, Record<string, [number, number]>> = {
  D: { FR: [8, 4], FL: [9, 5], BL: [11, 6], BR: [10, 7] },
  U: { FR: [8, 0], FL: [9, 3], BL: [11, 2], BR: [10, 1] },
  F: { FR: [1, 0], FL: [3, 3], BL: [7, 5], BR: [5, 4] },
  B: { FR: [1, 1], FL: [3, 2], BL: [7, 6], BR: [5, 7] },
  R: { FR: [0, 0], FL: [2, 1], BL: [6, 7], BR: [4, 4] },
  L: { FR: [0, 3], FL: [2, 2], BL: [6, 6], BR: [4, 5] },
};

const MOVE_NAMES = [
  'R', "R'", 'R2',
  'L', "L'", 'L2',
  'U', "U'", 'U2',
  'D', "D'", 'D2',
  'F', "F'", 'F2',
  'B', "B'", 'B2',
];

function moveFaceIndex(moveIndex: number): number {
  return Math.floor(moveIndex / 3);
}

// Transform tables: how each of 18 moves affects edge/corner positions and orientations
let edgeTransforms: { perm: number[]; orient: number[] }[] | null = null;
let cornerTransforms: { perm: number[]; orient: number[] }[] | null = null;

function buildTransformTables(kpuzzle: KPuzzle): void {
  edgeTransforms = [];
  cornerTransforms = [];
  for (const moveName of MOVE_NAMES) {
    const transform = kpuzzle.moveToTransformation(moveName);

    const edgeData = transform.transformationData['EDGES'];
    const ePerm = Array.from(edgeData.permutation);
    const eInvPerm = new Array(ePerm.length);
    for (let i = 0; i < ePerm.length; i++) eInvPerm[ePerm[i]] = i;
    edgeTransforms.push({ perm: eInvPerm, orient: Array.from(edgeData.orientationDelta) });

    const cornerData = transform.transformationData['CORNERS'];
    const cPerm = Array.from(cornerData.permutation);
    const cInvPerm = new Array(cPerm.length);
    for (let i = 0; i < cPerm.length; i++) cInvPerm[cPerm[i]] = i;
    cornerTransforms.push({ perm: cInvPerm, orient: Array.from(cornerData.orientationDelta) });
  }
}

export function initXCrossSolver(kpuzzle: KPuzzle): void {
  if (edgeTransforms !== null) return;
  initCrossSolver(kpuzzle);
  buildTransformTables(kpuzzle);
}

interface XCrossState {
  // 4 cross edges + 1 F2L edge positions and orientations
  edgePos: number[];    // length 5
  edgeOri: number[];    // length 5
  // 1 F2L corner position and orientation
  cornerPos: number;
  cornerOri: number;
}

function extractState(
  pattern: KPattern,
  crossEdges: number[],
  f2lEdge: number,
  f2lCorner: number,
): XCrossState {
  const edgeData = pattern.patternData['EDGES'];
  const cornerData = pattern.patternData['CORNERS'];

  const edgePos: number[] = [];
  const edgeOri: number[] = [];

  // 4 cross edges
  for (const targetIdx of crossEdges) {
    const pos = edgeData.pieces.indexOf(targetIdx);
    edgePos.push(pos);
    edgeOri.push(edgeData.orientation[pos]);
  }

  // F2L edge
  const f2lEdgePos = edgeData.pieces.indexOf(f2lEdge);
  edgePos.push(f2lEdgePos);
  edgeOri.push(edgeData.orientation[f2lEdgePos]);

  // F2L corner
  const f2lCornerPos = cornerData.pieces.indexOf(f2lCorner);

  return {
    edgePos,
    edgeOri,
    cornerPos: f2lCornerPos,
    cornerOri: cornerData.orientation[f2lCornerPos],
  };
}

function applyMove(state: XCrossState, moveIdx: number): XCrossState {
  const et = edgeTransforms![moveIdx];
  const ct = cornerTransforms![moveIdx];

  const newEdgePos: number[] = [];
  const newEdgeOri: number[] = [];

  for (let i = 0; i < 5; i++) {
    const oldPos = state.edgePos[i];
    const newPos = et.perm[oldPos];
    newEdgePos.push(newPos);
    newEdgeOri.push((state.edgeOri[i] + et.orient[newPos]) % 2);
  }

  const newCornerPos = ct.perm[state.cornerPos];
  const newCornerOri = (state.cornerOri + ct.orient[newCornerPos]) % 3;

  return {
    edgePos: newEdgePos,
    edgeOri: newEdgeOri,
    cornerPos: newCornerPos,
    cornerOri: newCornerOri,
  };
}

function isGoal(
  state: XCrossState,
  crossEdges: number[],
  f2lEdge: number,
  f2lCorner: number,
): boolean {
  // Cross edges must be in their home positions with orientation 0
  for (let i = 0; i < 4; i++) {
    if (state.edgePos[i] !== crossEdges[i] || state.edgeOri[i] !== 0) return false;
  }
  // F2L edge must be in home position with orientation 0
  if (state.edgePos[4] !== f2lEdge || state.edgeOri[4] !== 0) return false;
  // F2L corner must be in home position with orientation 0
  if (state.cornerPos !== f2lCorner || state.cornerOri !== 0) return false;
  return true;
}

function computeHeuristic(
  state: XCrossState,
  crossFace: string,
): number {
  return crossDepthFromEdgeState(state.edgePos, state.edgeOri, crossFace);
}

export interface XCrossSolution {
  moveCount: number;
  solution: string;
  slot: string;
}

function solveSlot(
  pattern: KPattern,
  crossFace: string,
  slotName: string,
  maxDepth: number,
): XCrossSolution[] {
  const crossEdges = FACE_CROSS_EDGES[crossFace];
  const slotDef = FACE_F2L_SLOTS[crossFace]?.[slotName];
  if (!crossEdges || !slotDef) return [];

  const [f2lEdge, f2lCorner] = slotDef;
  const startState = extractState(pattern, crossEdges, f2lEdge, f2lCorner);

  if (isGoal(startState, crossEdges, f2lEdge, f2lCorner)) {
    return [{ moveCount: 0, solution: '', slot: slotName }];
  }

  const MAX_SOLUTIONS = 20;
  const solutions: XCrossSolution[] = [];
  let foundDepth = -1;

  function dfs(
    state: XCrossState,
    depth: number,
    limit: number,
    lastFace: number,
    secondLastFace: number,
    path: number[],
  ): boolean {
    if (depth === limit) {
      if (isGoal(state, crossEdges, f2lEdge, f2lCorner)) {
        const moves = path.map(mi => MOVE_NAMES[mi]);
        solutions.push({
          moveCount: moves.length,
          solution: moves.join(' '),
          slot: slotName,
        });
        foundDepth = limit;
        return solutions.length >= MAX_SOLUTIONS;
      }
      return false;
    }

    const h = computeHeuristic(state, crossFace);
    if (depth + h > limit) return false;

    for (let mi = 0; mi < 18; mi++) {
      const face = moveFaceIndex(mi);
      // No same-face consecutive
      if (face === lastFace) continue;
      // Canonical ordering for opposite faces
      if ((face ^ 1) === lastFace && face > lastFace) continue;
      // Don't allow three moves in a row with same pair of opposite faces
      if ((face ^ 1) === lastFace && face === secondLastFace) continue;

      const newState = applyMove(state, mi);
      path.push(mi);
      if (dfs(newState, depth + 1, limit, face, lastFace, path)) return true;
      path.pop();
    }

    return false;
  }

  for (let limit = 0; limit <= maxDepth; limit++) {
    if (foundDepth >= 0 && limit > foundDepth) break;
    dfs(startState, 0, limit, -1, -1, []);
    if (solutions.length >= MAX_SOLUTIONS) break;
  }

  return solutions;
}

// Pairing detection: determines when an F2L corner-edge pair first becomes "paired up"
// (geometrically adjacent with matching stickers on shared faces).

// Faces for each edge position (index = position)
const EDGE_POS_FACES: [string, string][] = [
  ['U','F'], ['U','R'], ['U','B'], ['U','L'],  // UF, UR, UB, UL
  ['D','F'], ['D','R'], ['D','B'], ['D','L'],  // DF, DR, DB, DL
  ['F','R'], ['F','L'], ['B','R'], ['B','L'],  // FR, FL, BR, BL
];

// Faces for each corner position (index = position)
const CORNER_POS_FACES: [string, string, string][] = [
  ['U','F','R'], ['U','R','B'], ['U','B','L'], ['U','L','F'],  // UFR, URB, UBL, ULF
  ['D','R','F'], ['D','F','L'], ['D','L','B'], ['D','B','R'],  // DRF, DFL, DLB, DBR
];

// Adjacency table: for each adjacent (edgePos, cornerPos) pair,
// stores [cornerFaceIdx matching edge face 0, cornerFaceIdx matching edge face 1].
// Every edge has exactly 2 adjacent corners (sharing both faces).
const ADJACENCY: Record<string, [number, number]> = {
  '0,0': [0,1], '0,3': [0,2],   // UF-UFR, UF-ULF
  '1,0': [0,2], '1,1': [0,1],   // UR-UFR, UR-URB
  '2,1': [0,2], '2,2': [0,1],   // UB-URB, UB-UBL
  '3,2': [0,2], '3,3': [0,1],   // UL-UBL, UL-ULF
  '4,4': [0,2], '4,5': [0,1],   // DF-DRF, DF-DFL
  '5,4': [0,1], '5,7': [0,2],   // DR-DRF, DR-DBR
  '6,6': [0,2], '6,7': [0,1],   // DB-DLB, DB-DBR
  '7,5': [0,2], '7,6': [0,1],   // DL-DFL, DL-DLB
  '8,0': [1,2], '8,4': [2,1],   // FR-UFR, FR-DRF
  '9,3': [2,1], '9,5': [1,2],   // FL-ULF, FL-DFL
  '10,1': [2,1], '10,7': [1,2], // BR-URB, BR-DBR
  '11,2': [1,2], '11,6': [2,1], // BL-UBL, BL-DLB
};

// Check if an F2L edge-corner pair is "paired up" at their current positions.
// Paired = geometrically adjacent with matching stickers on the 2 shared faces.
export function isPairPaired(
  edgePiece: number, cornerPiece: number,
  edgePos: number, edgeOri: number,
  cornerPos: number, cornerOri: number,
): boolean {
  const adj = ADJACENCY[`${edgePos},${cornerPos}`];
  if (!adj) return false; // not adjacent

  // Edge sticker on face index i = home face at index (i + eOri) % 2
  const eColors = EDGE_POS_FACES[edgePiece];
  const eSticker0 = eColors[(0 + edgeOri) % 2];
  const eSticker1 = eColors[(1 + edgeOri) % 2];

  // Corner sticker on face index i = home face at index (i + cOri) % 3
  const cColors = CORNER_POS_FACES[cornerPiece];
  const cSticker0 = cColors[(adj[0] + cornerOri) % 3];
  const cSticker1 = cColors[(adj[1] + cornerOri) % 3];

  return eSticker0 === cSticker0 && eSticker1 === cSticker1;
}

// Find the 1-based move index where the F2L pair first becomes paired during the solution.
// Returns 0 if already paired before any moves, -1 if never paired (shouldn't happen).
export function findPairingMove(
  pattern: KPattern,
  solution: string,
  crossFace: string,
  slot: string,
): number {
  const slotDef = FACE_F2L_SLOTS[crossFace]?.[slot];
  if (!slotDef) return -1;
  const [edgePiece, cornerPiece] = slotDef;

  const checkPaired = (pat: KPattern): boolean => {
    const edgeData = pat.patternData['EDGES'];
    const cornerData = pat.patternData['CORNERS'];
    const ePos = edgeData.pieces.indexOf(edgePiece);
    const eOri = edgeData.orientation[ePos];
    const cPos = cornerData.pieces.indexOf(cornerPiece);
    const cOri = cornerData.orientation[cPos];
    return isPairPaired(edgePiece, cornerPiece, ePos, eOri, cPos, cOri);
  };

  if (checkPaired(pattern)) return 0;

  const moves = solution.split(/\s+/).filter(Boolean);
  let current = pattern;
  for (let i = 0; i < moves.length; i++) {
    current = current.applyAlg(moves[i]);
    if (checkPaired(current)) return i + 1;
  }

  return -1;
}

export function solveXCross(
  pattern: KPattern,
  crossFace: string = 'D',
  slots?: string[],
  maxDepth: number = 10,
): XCrossSolution[] {
  if (!edgeTransforms) throw new Error('XCross solver not initialized. Call initXCrossSolver() first.');

  const slotsToTry = slots && slots.length > 0 ? slots : ['FR', 'FL', 'BL', 'BR'];
  const allSolutions: XCrossSolution[] = [];

  for (const slot of slotsToTry) {
    const slotSolutions = solveSlot(pattern, crossFace, slot, maxDepth);
    allSolutions.push(...slotSolutions);
  }

  allSolutions.sort((a, b) => a.moveCount - b.moveCount);
  return allSolutions;
}

