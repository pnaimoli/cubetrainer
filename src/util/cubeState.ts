import { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { GanCubeConnection } from 'gan-web-bluetooth';


// Facelet indices for each edge position in kpuzzle order:
// UF, UR, UB, UL, DF, DR, DB, DL, FR, FL, BR, BL
const EDGE_FACELETS: [number, number][] = [
  [7, 19],   // UF
  [5, 10],   // UR
  [1, 46],   // UB
  [3, 37],   // UL
  [28, 25],  // DF
  [32, 16],  // DR
  [34, 52],  // DB
  [30, 43],  // DL
  [23, 12],  // FR
  [21, 41],  // FL
  [48, 14],  // BR
  [50, 39],  // BL
];

// Facelet indices for each corner position in kpuzzle order:
// UFR, URB, UBL, ULF, DRF, DFL, DLB, DBR
// Order: [reference sticker, 2nd sticker, 3rd sticker] following the piece name order
const CORNER_FACELETS: [number, number, number][] = [
  [8, 20, 9],    // UFR: U, F, R
  [2, 11, 45],   // URB: U, R, B
  [0, 47, 36],   // UBL: U, B, L
  [6, 38, 18],   // ULF: U, L, F
  [29, 15, 26],  // DRF: D, R, F
  [27, 24, 44],  // DFL: D, F, L
  [33, 42, 53],  // DLB: D, L, B
  [35, 51, 17],  // DBR: D, B, R
];

const EDGE_NAMES = ['UF', 'UR', 'UB', 'UL', 'DF', 'DR', 'DB', 'DL', 'FR', 'FL', 'BR', 'BL'];
const CORNER_NAMES = ['UFR', 'URB', 'UBL', 'ULF', 'DRF', 'DFL', 'DLB', 'DBR'];

function rotateLeft(s: string, n: number): string {
  return s.slice(n) + s.slice(0, n);
}

// Build lookup maps from piece name (including rotations) to {index, orientation}
function buildEdgeMap(): Map<string, { index: number; orientation: number }> {
  const map = new Map<string, { index: number; orientation: number }>();
  for (let i = 0; i < EDGE_NAMES.length; i++) {
    for (let ori = 0; ori < 2; ori++) {
      const name = rotateLeft(EDGE_NAMES[i], ori);
      map.set(name, { index: i, orientation: ori });
    }
  }
  return map;
}

function buildCornerMap(): Map<string, { index: number; orientation: number }> {
  const map = new Map<string, { index: number; orientation: number }>();
  for (let i = 0; i < CORNER_NAMES.length; i++) {
    for (let ori = 0; ori < 3; ori++) {
      const name = rotateLeft(CORNER_NAMES[i], ori);
      map.set(name, { index: i, orientation: ori });
      // Also add the alternate ordering (swap last two chars)
      const alt = name[0] + name[2] + name[1];
      map.set(alt, { index: i, orientation: ori });
    }
  }
  return map;
}

const edgeMap = buildEdgeMap();
const cornerMap = buildCornerMap();

/**
 * Convert a Kociemba facelets string (54 chars, URFDLB order) to a KPattern.
 */
export function faceletsToKPattern(facelets: string, kpuzzle: KPuzzle): KPattern {
  // Edges
  const edgePieces: number[] = new Array(12);
  const edgeOri: number[] = new Array(12);
  for (let pos = 0; pos < 12; pos++) {
    const [f0, f1] = EDGE_FACELETS[pos];
    const c0 = facelets[f0]; // color at reference slot
    const c1 = facelets[f1]; // color at secondary slot

    // If the colors match the faces of the slot, the stickers are original face colors.
    // But with a scrambled cube, we need to look up which piece has those colors.
    // The facelet positions tell us which face each slot is on.
    // For edge at position UF: slot 0 is on U face, slot 1 is on F face.
    // The color at slot 0 tells us which face's sticker is there.

    // Build the piece name from sticker colors
    const name = c0 + c1;
    const entry = edgeMap.get(name);
    if (!entry) {
      // Shouldn't happen with a valid cube state
      // If the facelets string uses lowercase or differs, handle gracefully
      throw new Error(`Unknown edge stickers: ${name} at position ${EDGE_NAMES[pos]}`);
    }

    // entry.index = which piece, entry.orientation = orientation relative to piece's reference
    // But we need orientation relative to the POSITION, not just the piece.
    // Since our facelet map lists position's reference face first, the orientation from
    // the lookup directly gives us the kpuzzle orientation.

    // However, there's a subtlety: the orientation in kpuzzle measures how the piece's
    // reference sticker relates to the position's reference face.
    // If the sticker name starts with the piece's reference face (orientation=0 in our map),
    // that means the piece's reference sticker IS at slot 0 (the position's reference face).
    // This corresponds to kpuzzle orientation 0 only if the position's reference face type
    // matches the piece's reference face type (both U/D or both F/B/L/R).

    // For standard 3x3 edge orientation: orientation 0 means the piece's reference sticker
    // is on the reference face of the position. Our lookup already gives us this.
    edgePieces[pos] = entry.index;
    edgeOri[pos] = entry.orientation;
  }

  // Corners
  const cornerPieces: number[] = new Array(8);
  const cornerOri: number[] = new Array(8);
  for (let pos = 0; pos < 8; pos++) {
    const [f0, f1, f2] = CORNER_FACELETS[pos];
    const c0 = facelets[f0];
    const c1 = facelets[f1];
    const c2 = facelets[f2];

    const name = c0 + c1 + c2;
    const entry = cornerMap.get(name);
    if (!entry) {
      throw new Error(`Unknown corner stickers: ${name} at position ${CORNER_NAMES[pos]}`);
    }
    cornerPieces[pos] = entry.index;
    cornerOri[pos] = entry.orientation;
  }

  // Centers are fixed on a 3x3 (ignoring super cube)
  const centerPieces = [0, 1, 2, 3, 4, 5];
  const centerOri = [0, 0, 0, 0, 0, 0];

  // But wait: the kpuzzle center order is ULFRBD per SolveChecker.ts
  // The facelets center stickers are at indices 4, 13, 22, 31, 40, 49 for U, R, F, D, L, B
  // kpuzzle centers: U=0, L=1, F=2, R=3, B=4, D=5
  // On a standard 3x3, centers don't move, so we just use identity.

  return new KPattern(kpuzzle, {
    EDGES: { pieces: edgePieces, orientation: edgeOri },
    CORNERS: { pieces: cornerPieces, orientation: cornerOri },
    CENTERS: { pieces: centerPieces, orientation: centerOri },
  });
}

/**
 * Check if two patterns are equal (same pieces and orientations for all orbits).
 */
export function patternsEqual(a: KPattern, b: KPattern): boolean {
  for (const orbit of a.kpuzzle.definition.orbits) {
    const name = orbit.orbitName;
    const aData = a.patternData[name];
    const bData = b.patternData[name];
    for (let i = 0; i < aData.pieces.length; i++) {
      if (aData.pieces[i] !== bData.pieces[i]) return false;
      if (aData.orientation[i] !== bData.orientation[i]) return false;
    }
  }
  return true;
}

/**
 * Request the current cube state (facelets) from a GAN cube via BLE.
 * Returns a promise that resolves with the facelets string.
 */
export function requestFacelets(conn: GanCubeConnection): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      sub.unsubscribe();
      reject(new Error('Facelets request timed out'));
    }, 5000);

    const sub = conn.events$.subscribe(event => {
      if (event.type === 'FACELETS') {
        clearTimeout(timeout);
        sub.unsubscribe();
        resolve(event.facelets);
      }
    });
    conn.sendCubeCommand({ type: 'REQUEST_FACELETS' });
  });
}

/**
 * Compute the moves needed to transition the cube from its current state
 * to the desired scramble state.
 *
 * Returns an array of move strings for the ScrambleGuide.
 * If the cube is already in the desired state, returns [].
 */
export async function computeTransitionMoves(
  currentFacelets: string,
  scramble: string,
  kpuzzle: KPuzzle,
): Promise<string[]> {
  const currentPattern = faceletsToKPattern(currentFacelets, kpuzzle);
  const desiredPattern = kpuzzle.defaultPattern().applyAlg(scramble);

  // Already at desired state
  if (patternsEqual(currentPattern, desiredPattern)) return [];

  // If cube is solved, just use scramble directly
  if (patternsEqual(currentPattern, kpuzzle.defaultPattern())) {
    return scramble.split(/\s+/).filter(Boolean);
  }

  // Construct the "difference pattern" and solve it directly.
  // We want moves M such that current.applyAlg(M) = desired.
  // If we build diff = desired^{-1} * current, then solve(diff) = diff^{-1} = current^{-1} * desired = M.
  const currentTransform = currentPattern.experimentalToTransformation()!;
  const desiredTransform = desiredPattern.experimentalToTransformation()!;
  const diffTransform = desiredTransform.invert().applyTransformation(currentTransform);
  const diffPattern = diffTransform.toKPattern();

  const { experimentalSolve3x3x3IgnoringCenters } = await import('cubing/search');
  const solveAlg = await experimentalSolve3x3x3IgnoringCenters(diffPattern);
  const solveStr = solveAlg.toString();
  return solveStr.split(/\s+/).filter(Boolean);
}

/**
 * Simplify a move sequence by canceling adjacent inverse moves.
 * E.g., ["R", "R'"] -> [], ["R", "R", "R"] -> ["R'"]
 */
export function simplifyMoves(moves: string[]): string[] {
  // Convert moves to a canonical form and cancel
  const result: string[] = [];
  for (const move of moves) {
    if (result.length > 0) {
      const last = result[result.length - 1];
      const lastFace = last.replace(/[2']/g, '');
      const curFace = move.replace(/[2']/g, '');

      if (lastFace === curFace) {
        // Same face, combine quarter turns
        const lastCount = quarterTurnCount(last);
        const curCount = quarterTurnCount(move);
        const total = ((lastCount + curCount) % 4 + 4) % 4;

        result.pop();
        if (total === 1) result.push(lastFace);
        else if (total === 2) result.push(`${lastFace}2`);
        else if (total === 3) result.push(`${lastFace}'`);
        // total === 0 means they cancel
        continue;
      }
    }
    result.push(move);
  }
  return result;
}

/**
 * Count moves in half-turn metric from a list of quarter-turn BLE events.
 * Collapses consecutive same-face quarter turns (R R → R2 = 1 HTM).
 */
export function movesToHTM(quarterTurns: string[]): number {
  return simplifyMoves(quarterTurns).length;
}

function quarterTurnCount(move: string): number {
  if (move.includes("'")) return move.includes('2') ? 2 : 3; // X' = 3 quarter turns, X2' = 2
  if (move.includes('2')) return 2;
  return 1;
}
