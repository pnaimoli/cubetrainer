import { KPuzzle, KPattern } from 'cubing/kpuzzle';
import { countCrossEdgesInPlace } from './crossSolver';
import { translateMove } from './crossRotation';

// D-cross edge indices: DF=4, DR=5, DB=6, DL=7
const D_CROSS_EDGES = [4, 5, 6, 7];

// Fisher-Yates shuffle (in-place)
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Compute parity of a permutation (true = odd, false = even)
function permutationParity(perm: number[]): boolean {
  const visited = new Array(perm.length).fill(false);
  let parity = false;
  for (let i = 0; i < perm.length; i++) {
    if (visited[i]) continue;
    let cycleLen = 0;
    let j = i;
    while (!visited[j]) {
      visited[j] = true;
      j = perm[j];
      cycleLen++;
    }
    if (cycleLen % 2 === 0) parity = !parity; // even-length cycle = odd parity contribution
  }
  return parity;
}

/**
 * Generate a random solvable cube state with exactly `fixedCount` D-cross
 * edges at their home positions (piece=index, orientation=0).
 *
 * Ensures valid parity and orientation constraints so the state is solvable.
 */
export function generateRandomCubeState(kpuzzle: KPuzzle, fixedCount: number): KPattern {
  // Pick which D-cross edges are fixed in place
  const crossIndices = shuffle([...D_CROSS_EDGES]);
  const fixedPositions = new Set(crossIndices.slice(0, fixedCount));

  // Build edge permutation and orientation
  const edgePieces = new Array(12).fill(-1);
  const edgeOri = new Array(12).fill(0);

  // Place fixed edges
  for (const pos of fixedPositions) {
    edgePieces[pos] = pos;
    edgeOri[pos] = 0;
  }

  // Remaining positions and pieces
  const remainingPositions: number[] = [];
  const remainingPieces: number[] = [];
  for (let i = 0; i < 12; i++) {
    if (!fixedPositions.has(i)) {
      remainingPositions.push(i);
      remainingPieces.push(i);
    }
  }

  // Shuffle remaining edges
  shuffle(remainingPieces);
  for (let i = 0; i < remainingPositions.length; i++) {
    edgePieces[remainingPositions[i]] = remainingPieces[i];
  }

  // Random edge orientations for non-fixed edges, sum must be even
  let edgeOriSum = 0;
  for (let i = 0; i < remainingPositions.length - 1; i++) {
    const ori = Math.floor(Math.random() * 2);
    edgeOri[remainingPositions[i]] = ori;
    edgeOriSum += ori;
  }
  // Last non-fixed edge: adjust to make total even
  edgeOri[remainingPositions[remainingPositions.length - 1]] = edgeOriSum % 2;

  // Random corner permutation
  const cornerPieces = shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
  const cornerOri = new Array(8).fill(0);
  let cornerOriSum = 0;
  for (let i = 0; i < 7; i++) {
    const ori = Math.floor(Math.random() * 3);
    cornerOri[i] = ori;
    cornerOriSum += ori;
  }
  cornerOri[7] = (3 - (cornerOriSum % 3)) % 3;

  // Parity check: edge perm parity must equal corner perm parity
  const edgeParity = permutationParity(edgePieces);
  const cornerParity = permutationParity(cornerPieces);
  if (edgeParity !== cornerParity) {
    // Swap first two non-fixed edges to fix parity
    const p0 = remainingPositions[0];
    const p1 = remainingPositions[1];
    [edgePieces[p0], edgePieces[p1]] = [edgePieces[p1], edgePieces[p0]];
  }

  const state = new KPattern(kpuzzle, {
    EDGES: { pieces: edgePieces, orientation: edgeOri },
    CORNERS: { pieces: cornerPieces, orientation: cornerOri },
    CENTERS: { pieces: [0, 1, 2, 3, 4, 5], orientation: [0, 0, 0, 0, 0, 0] },
  });

  // Apply a random D rotation so fixed cross edges aren't always at identity.
  // countCrossEdgesInPlace checks all 4 rotations, so pip count is preserved.
  // D is a legal move, so solvability is preserved.
  const rotations = ['', 'D', 'D2', "D'"];
  const r = rotations[Math.floor(Math.random() * 4)];
  return r ? state.applyAlg(r) : state;
}

/**
 * Convert a cube state (KPattern) to a scramble string by solving it
 * with Kociemba and inverting the solution.
 */
export async function patternToScramble(pattern: KPattern): Promise<string> {
  const { experimentalSolve3x3x3IgnoringCenters } = await import('cubing/search');
  const solution = await experimentalSolve3x3x3IgnoringCenters(pattern);
  return solution.invert().toString();
}

export interface CrossScrambleOptions {
  piecesInPlace: number | null; // exact pip count, or null for unrestricted
}

/**
 * Generate a scramble with a specific number of D-cross edges in place.
 * If piecesInPlace is null, generates a fully random solvable state.
 * Returns the scramble string and the target pattern.
 */
export async function generateCrossScramble(
  kpuzzle: KPuzzle,
  options: CrossScrambleOptions,
): Promise<{ scramble: string; pattern: KPattern }> {
  const pip = options.piecesInPlace;

  if (pip === null) {
    // Unrestricted: fully random state, no pip constraint
    const state = generateRandomCubeState(kpuzzle, 0);
    const scramble = await patternToScramble(state);
    return { scramble, pattern: state };
  }

  // Generate a valid state with exact pip
  let state: KPattern;
  for (let attempt = 0; attempt < 50; attempt++) {
    state = generateRandomCubeState(kpuzzle, pip);

    // Verify pip is exact (random non-fixed edge placement
    // could accidentally align under a D rotation, giving higher pip)
    const actualPip = countCrossEdgesInPlace(state, 'D');
    if (actualPip === pip) {
      const scramble = await patternToScramble(state);
      return { scramble, pattern: state };
    }
  }

  // Fallback: accept whatever we got
  state = generateRandomCubeState(kpuzzle, pip);
  const scramble = await patternToScramble(state);
  return { scramble, pattern: state };
}

// Inverse of FACE_TO_D_ROTATION: rotations that map D to the target face
const D_TO_FACE_ROTATION: Record<string, string> = {
  D: '',
  U: 'x2',
  F: 'x',
  B: "x'",
  R: "z'",
  L: 'z',
};

/**
 * Translate a D-cross scramble for use with a different cross face.
 * Each move is remapped so that D-cross properties apply to the target face.
 */
export function rotateScramble(scramble: string, crossFace: string): string {
  if (crossFace === 'D' || !crossFace) return scramble;
  const rotation = D_TO_FACE_ROTATION[crossFace];
  if (!rotation) return scramble;
  return scramble
    .split(/\s+/)
    .filter(Boolean)
    .map(move => translateMove(move, rotation))
    .join(' ');
}
