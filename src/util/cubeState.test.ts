import { expect } from 'chai';
import { cube3x3x3 } from 'cubing/puzzles';
import { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { faceletsToKPattern, patternsEqual, computeTransitionMoves } from './cubeState';

// Solved cube facelets in Kociemba URFDLB order
const SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

describe('faceletsToKPattern', () => {
  it('converts solved facelets to the default (solved) pattern', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle() as unknown as KPuzzle;
    const pattern = faceletsToKPattern(SOLVED_FACELETS, kpuzzle);
    expect(patternsEqual(pattern, kpuzzle.defaultPattern())).to.equal(true);
  });

  it('converts a scrambled state and back correctly', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle() as unknown as KPuzzle;
    const scramble = "R U R' U'";
    const scrambledPattern = kpuzzle.defaultPattern().applyAlg(scramble);

    const facelets = patternToFacelets(scrambledPattern);
    const reconstructed = faceletsToKPattern(facelets, kpuzzle);
    expect(patternsEqual(reconstructed, scrambledPattern)).to.equal(true);
  });
});

describe('computeTransitionMoves', () => {
  it('returns empty array when cube is already at target', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle() as unknown as KPuzzle;
    const scramble = "R U R' U'";
    const scrambledPattern = kpuzzle.defaultPattern().applyAlg(scramble);
    const facelets = patternToFacelets(scrambledPattern);

    const moves = await computeTransitionMoves(facelets, scramble, kpuzzle);
    expect(moves).to.deep.equal([]);
  });

  it('returns scramble moves when cube is solved', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle() as unknown as KPuzzle;
    const scramble = "R U R' U'";

    const moves = await computeTransitionMoves(SOLVED_FACELETS, scramble, kpuzzle);
    expect(moves).to.deep.equal(["R", "U", "R'", "U'"]);
  });

  it('produces moves that transition from one scramble to another', async function () {
    this.timeout(30000);
    const kpuzzle = await cube3x3x3.kpuzzle() as unknown as KPuzzle;
    const currentScramble = "R U";
    const targetScramble = "R U R' U'";

    const currentPattern = kpuzzle.defaultPattern().applyAlg(currentScramble);
    const currentFacelets = patternToFacelets(currentPattern);

    const transitionMoves = await computeTransitionMoves(currentFacelets, targetScramble, kpuzzle);

    // Apply transition moves to current state and verify it reaches target
    const targetPattern = kpuzzle.defaultPattern().applyAlg(targetScramble);
    const resultPattern = currentPattern.applyAlg(transitionMoves.join(' '));
    expect(patternsEqual(resultPattern, targetPattern)).to.equal(true);
  });
});

// Helper: convert a KPattern back to Kociemba facelets string
// This reconstructs the 54-char string from piece/orientation data
function patternToFacelets(pattern: KPattern): string {
  const facelets = new Array(54).fill('?');
  const FACE_CHARS = 'URFDLB';

  // Face center indices in Kociemba order
  const CENTER_INDICES = [4, 13, 22, 31, 40, 49]; // U=4, R=13, F=22, D=31, L=40, B=49
  // kpuzzle center order: U=0, L=1, F=2, R=3, B=4, D=5
  // Kociemba face order:  U=0, R=1, F=2, D=3, L=4, B=5
  const KPUZZLE_TO_KOCIEMBA_CENTER = [0, 3, 2, 5, 1, 4]; // kpuzzle idx -> kociemba face idx
  for (let i = 0; i < 6; i++) {
    facelets[CENTER_INDICES[KPUZZLE_TO_KOCIEMBA_CENTER[i]]] = FACE_CHARS[KPUZZLE_TO_KOCIEMBA_CENTER[i]];
  }

  // Edge positions and their facelet indices (from cubeState.ts)
  const EDGE_FACELETS: [number, number][] = [
    [7, 19], [5, 10], [1, 46], [3, 37],
    [28, 25], [32, 16], [34, 52], [30, 43],
    [23, 12], [21, 41], [48, 14], [50, 39],
  ];
  const EDGE_NAMES = ['UF', 'UR', 'UB', 'UL', 'DF', 'DR', 'DB', 'DL', 'FR', 'FL', 'BR', 'BL'];

  // Corner positions and their facelet indices
  const CORNER_FACELETS: [number, number, number][] = [
    [8, 20, 9], [2, 11, 45], [0, 47, 36], [6, 38, 18],
    [29, 15, 26], [27, 24, 44], [33, 42, 53], [35, 51, 17],
  ];
  const CORNER_NAMES = ['UFR', 'URB', 'UBL', 'ULF', 'DRF', 'DFL', 'DLB', 'DBR'];

  const edges = pattern.patternData['EDGES'];
  for (let pos = 0; pos < 12; pos++) {
    const piece = edges.pieces[pos];
    const ori = edges.orientation[pos];
    const pieceName = EDGE_NAMES[piece];
    const rotated = pieceName.slice(ori) + pieceName.slice(0, ori);
    facelets[EDGE_FACELETS[pos][0]] = rotated[0];
    facelets[EDGE_FACELETS[pos][1]] = rotated[1];
  }

  const corners = pattern.patternData['CORNERS'];
  for (let pos = 0; pos < 8; pos++) {
    const piece = corners.pieces[pos];
    const ori = corners.orientation[pos];
    const pieceName = CORNER_NAMES[piece];
    const rotated = pieceName.slice(ori) + pieceName.slice(0, ori);
    facelets[CORNER_FACELETS[pos][0]] = rotated[0];
    facelets[CORNER_FACELETS[pos][1]] = rotated[1];
    facelets[CORNER_FACELETS[pos][2]] = rotated[2];
  }

  return facelets.join('');
}
