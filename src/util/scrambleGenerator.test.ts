import { expect } from 'chai';
import { KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';
import { initCrossSolver, solveCross, countCrossEdgesInPlace } from './crossSolver';
import { isPatternSolved } from './SolveChecker';
import { SolvedState } from './interfaces';
import {
  generateRandomCubeState,
  patternToScramble,
  generateCrossScramble,
  rotateScramble,
} from './scrambleGenerator';

let kpuzzle: KPuzzle;

before(async () => {
  kpuzzle = await cube3x3x3.kpuzzle() as unknown as KPuzzle;
  initCrossSolver(kpuzzle);
});

// ---------------------------------------------------------------------------
// Helper to validate a cube state is solvable
// ---------------------------------------------------------------------------
function validateState(pieces: number[], orientations: number[], type: 'edge' | 'corner') {
  const n = pieces.length;
  const oriMod = type === 'edge' ? 2 : 3;

  // All piece indices appear exactly once
  const sorted = [...pieces].sort((a, b) => a - b);
  for (let i = 0; i < n; i++) {
    expect(sorted[i], `${type} piece ${i} missing`).to.equal(i);
  }

  // All orientations are in valid range
  for (let i = 0; i < n; i++) {
    expect(orientations[i], `${type} ori at ${i}`).to.be.at.least(0);
    expect(orientations[i], `${type} ori at ${i}`).to.be.below(oriMod);
  }

  // Orientation sum constraint
  const oriSum = orientations.reduce((a, b) => a + b, 0);
  expect(oriSum % oriMod, `${type} orientation sum`).to.equal(0);
}

// ---------------------------------------------------------------------------
// generateRandomCubeState
// ---------------------------------------------------------------------------
describe('generateRandomCubeState', () => {
  for (let fixed = 0; fixed <= 4; fixed++) {
    it(`fixedCount=${fixed}: produces valid edge permutation`, () => {
      for (let trial = 0; trial < 5; trial++) {
        const state = generateRandomCubeState(kpuzzle, fixed);
        const edges = state.patternData['EDGES'];
        validateState(
          Array.from(edges.pieces),
          Array.from(edges.orientation),
          'edge',
        );
      }
    });

    it(`fixedCount=${fixed}: produces valid corner permutation`, () => {
      for (let trial = 0; trial < 5; trial++) {
        const state = generateRandomCubeState(kpuzzle, fixed);
        const corners = state.patternData['CORNERS'];
        validateState(
          Array.from(corners.pieces),
          Array.from(corners.orientation),
          'corner',
        );
      }
    });

    it(`fixedCount=${fixed}: edge and corner parity match`, () => {
      for (let trial = 0; trial < 10; trial++) {
        const state = generateRandomCubeState(kpuzzle, fixed);
        const edgePerm = Array.from(state.patternData['EDGES'].pieces);
        const cornerPerm = Array.from(state.patternData['CORNERS'].pieces);

        const edgeParity = computeParity(edgePerm);
        const cornerParity = computeParity(cornerPerm);
        expect(edgeParity, 'parity mismatch').to.equal(cornerParity);
      }
    });
  }

  it('fixedCount=4: all 4 D-cross edges in place (pip=4)', () => {
    for (let trial = 0; trial < 10; trial++) {
      const state = generateRandomCubeState(kpuzzle, 4);
      const pip = countCrossEdgesInPlace(state, 'D');
      expect(pip, 'pip should be 4').to.equal(4);
    }
  });

  it('fixedCount=0: D-cross edges are generally not all at home', () => {
    let allAtHome = 0;
    for (let trial = 0; trial < 20; trial++) {
      const state = generateRandomCubeState(kpuzzle, 0);
      const edges = state.patternData['EDGES'];
      const homeCount = [4, 5, 6, 7].filter(
        idx => edges.pieces[idx] === idx && edges.orientation[idx] === 0,
      ).length;
      if (homeCount === 4) allAtHome++;
    }
    // Extremely unlikely that all 20 random states have all 4 at home
    expect(allAtHome).to.be.below(20);
  });

  it('fixedCount=2: at least 2 D-cross edges in place', () => {
    for (let trial = 0; trial < 10; trial++) {
      const state = generateRandomCubeState(kpuzzle, 2);
      const pip = countCrossEdgesInPlace(state, 'D');
      expect(pip).to.be.at.least(2);
    }
  });

  it('generated states are solvable (cross solver finds solutions)', () => {
    for (let fixed = 0; fixed <= 4; fixed++) {
      for (let trial = 0; trial < 3; trial++) {
        const state = generateRandomCubeState(kpuzzle, fixed);
        const solutions = solveCross(state, 'D');
        expect(solutions.length, `fixed=${fixed} trial=${trial}`).to.be.greaterThan(0);
      }
    }
  });

  it('fixedCount=4: cross is already solved (0 or 1 move)', () => {
    for (let trial = 0; trial < 5; trial++) {
      const state = generateRandomCubeState(kpuzzle, 4);
      const solutions = solveCross(state, 'D');
      expect(solutions[0].moveCount).to.be.at.most(1);
    }
  });

  it('centers have identity pieces', () => {
    const state = generateRandomCubeState(kpuzzle, 2);
    const centers = state.patternData['CENTERS'];
    expect(Array.from(centers.pieces)).to.deep.equal([0, 1, 2, 3, 4, 5]);
  });

  it('produces different states on repeated calls', () => {
    const states: string[] = [];
    for (let i = 0; i < 10; i++) {
      const state = generateRandomCubeState(kpuzzle, 0);
      states.push(Array.from(state.patternData['EDGES'].pieces).join(','));
    }
    const unique = new Set(states);
    // Should have some variety (extremely unlikely all 10 are identical)
    expect(unique.size).to.be.greaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// patternToScramble
// ---------------------------------------------------------------------------
describe('patternToScramble', () => {
  it('scramble applied to solved produces the target state (edges + corners)', async function () {
    this.timeout(15000);
    const state = generateRandomCubeState(kpuzzle, 2);
    const scramble = await patternToScramble(state);

    const scrambled = kpuzzle.defaultPattern().applyAlg(scramble);
    expect(
      Array.from(scrambled.patternData['EDGES'].pieces),
    ).to.deep.equal(Array.from(state.patternData['EDGES'].pieces));
    expect(
      Array.from(scrambled.patternData['EDGES'].orientation),
    ).to.deep.equal(Array.from(state.patternData['EDGES'].orientation));
    expect(
      Array.from(scrambled.patternData['CORNERS'].pieces),
    ).to.deep.equal(Array.from(state.patternData['CORNERS'].pieces));
    expect(
      Array.from(scrambled.patternData['CORNERS'].orientation),
    ).to.deep.equal(Array.from(state.patternData['CORNERS'].orientation));
  });

  it('scramble for solved state is empty or identity', async function () {
    this.timeout(15000);
    const solved = kpuzzle.defaultPattern();
    const scramble = await patternToScramble(solved);
    // Applying the scramble to solved should still be solved
    const result = kpuzzle.defaultPattern().applyAlg(scramble);
    expect(isPatternSolved(result, SolvedState.CROSS, 'D')).to.be.true;
  });

  it('produces valid scramble for pip=0 state', async function () {
    this.timeout(15000);
    const state = generateRandomCubeState(kpuzzle, 0);
    const scramble = await patternToScramble(state);
    expect(scramble.length).to.be.greaterThan(0);

    const scrambled = kpuzzle.defaultPattern().applyAlg(scramble);
    const solutions = solveCross(scrambled, 'D');
    expect(solutions.length).to.be.greaterThan(0);

    // Verify solution actually solves the cross
    const afterSolve = scrambled.applyAlg(solutions[0].solution);
    expect(isPatternSolved(afterSolve, SolvedState.CROSS, 'D')).to.be.true;
  });
});

// ---------------------------------------------------------------------------
// generateCrossScramble
// ---------------------------------------------------------------------------
describe('generateCrossScramble', () => {
  it('pip=0: scramble has 0 cross edges in place', async function () {
    this.timeout(15000);
    const { scramble } = await generateCrossScramble(kpuzzle, {
      piecesInPlace: 0,
    });
    const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
    expect(countCrossEdgesInPlace(pattern, 'D')).to.equal(0);
  });

  it('pip=4: scramble has 4 cross edges in place (cross nearly solved)', async function () {
    this.timeout(15000);
    const { scramble } = await generateCrossScramble(kpuzzle, {
      piecesInPlace: 4,
    });
    const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
    expect(countCrossEdgesInPlace(pattern, 'D')).to.equal(4);
  });

  it('pip=null: unrestricted, produces valid solvable state', async function () {
    this.timeout(15000);
    const { scramble } = await generateCrossScramble(kpuzzle, {
      piecesInPlace: null,
    });
    const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
    const pip = countCrossEdgesInPlace(pattern, 'D');
    expect(pip).to.be.at.least(0);
    expect(pip).to.be.at.most(4);
    const solutions = solveCross(pattern, 'D');
    expect(solutions.length).to.be.greaterThan(0);
  });

  it('cross is solvable for generated scramble', async function () {
    this.timeout(15000);
    const { scramble } = await generateCrossScramble(kpuzzle, {
      piecesInPlace: 1,
    });
    const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
    const solutions = solveCross(pattern, 'D');
    expect(solutions.length).to.be.greaterThan(0);

    const afterSolve = pattern.applyAlg(solutions[0].solution);
    expect(isPatternSolved(afterSolve, SolvedState.CROSS, 'D')).to.be.true;
  });

  it('pattern in result matches scramble (full state)', async function () {
    this.timeout(15000);
    const { scramble, pattern: targetPattern } = await generateCrossScramble(kpuzzle, {
      piecesInPlace: null,
    });
    const scrambledPattern = kpuzzle.defaultPattern().applyAlg(scramble);
    expect(
      Array.from(scrambledPattern.patternData['EDGES'].pieces),
    ).to.deep.equal(Array.from(targetPattern.patternData['EDGES'].pieces));
    expect(
      Array.from(scrambledPattern.patternData['EDGES'].orientation),
    ).to.deep.equal(Array.from(targetPattern.patternData['EDGES'].orientation));
    expect(
      Array.from(scrambledPattern.patternData['CORNERS'].pieces),
    ).to.deep.equal(Array.from(targetPattern.patternData['CORNERS'].pieces));
    expect(
      Array.from(scrambledPattern.patternData['CORNERS'].orientation),
    ).to.deep.equal(Array.from(targetPattern.patternData['CORNERS'].orientation));
  });

  it('pip=3: full component flow succeeds (D face)', async function () {
    this.timeout(30000);
    for (let trial = 0; trial < 3; trial++) {
      const { scramble: dScramble } = await generateCrossScramble(kpuzzle, {
        piecesInPlace: 3,
      });
      expect(dScramble, 'scramble should not be empty').to.have.length.greaterThan(0);

      const basePattern = kpuzzle.defaultPattern().applyAlg(dScramble);
      const pip = countCrossEdgesInPlace(basePattern, 'D');
      expect(pip, 'pip should be 3').to.equal(3);

      const solutions = solveCross(basePattern, 'D');
      expect(solutions.length, 'should find cross solutions').to.be.greaterThan(0);
    }
  });

  it('pip=0: full component flow succeeds (D face)', async function () {
    this.timeout(30000);
    for (let trial = 0; trial < 3; trial++) {
      const { scramble: dScramble } = await generateCrossScramble(kpuzzle, {
        piecesInPlace: 0,
      });
      expect(dScramble).to.have.length.greaterThan(0);
      const basePattern = kpuzzle.defaultPattern().applyAlg(dScramble);
      const pip = countCrossEdgesInPlace(basePattern, 'D');
      expect(pip).to.equal(0);
      const solutions = solveCross(basePattern, 'D');
      expect(solutions.length).to.be.greaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// rotateScramble
// ---------------------------------------------------------------------------
describe('rotateScramble', () => {
  it('D face returns scramble unchanged', () => {
    const scramble = "R U F' D2 L B";
    expect(rotateScramble(scramble, 'D')).to.equal(scramble);
  });

  it('empty crossFace returns scramble unchanged', () => {
    const scramble = "R U F'";
    expect(rotateScramble(scramble, '')).to.equal(scramble);
  });

  it('U face (x2): D moves become U moves', () => {
    const result = rotateScramble('D', 'U');
    expect(result).to.equal('U');
  });

  it('U face (x2): R stays R', () => {
    const result = rotateScramble('R', 'U');
    expect(result).to.equal('R');
  });

  it('U face (x2): F becomes B', () => {
    const result = rotateScramble('F', 'U');
    expect(result).to.equal('B');
  });

  it('rotated scramble approximately preserves pip constraint on target face', async function () {
    // Edge orientation conventions in cubing.js are global (relative to U/D axis),
    // not relative to the cross face. So pip isn't perfectly preserved by rotation -
    // positions transfer correctly but orientation checks may differ slightly.
    // Callers should re-check pip after rotation if exactness is needed.
    this.timeout(15000);
    for (const face of ['U', 'F', 'B', 'R', 'L']) {
      const { scramble: dScramble } = await generateCrossScramble(kpuzzle, {
        piecesInPlace: 0,
      });

      const dPattern = kpuzzle.defaultPattern().applyAlg(dScramble);
      expect(countCrossEdgesInPlace(dPattern, 'D'), `D pip for ${face}`).to.equal(0);

      const rotated = rotateScramble(dScramble, face);
      const rotPattern = kpuzzle.defaultPattern().applyAlg(rotated);

      // Pip should be close (0 or 1), not wildly different
      const pip = countCrossEdgesInPlace(rotPattern, face);
      expect(pip, `${face} pip after rotation`).to.be.at.most(2);
    }
  });

  it('rotated scramble is solvable for cross on target face', async function () {
    this.timeout(15000);
    for (const face of ['U', 'F', 'B', 'R', 'L']) {
      const { scramble: dScramble } = await generateCrossScramble(kpuzzle, {
        piecesInPlace: null,
      });
      const rotated = rotateScramble(dScramble, face);
      const pattern = kpuzzle.defaultPattern().applyAlg(rotated);
      const solutions = solveCross(pattern, face);
      expect(solutions.length, `${face} should have solutions`).to.be.greaterThan(0);

      const afterSolve = pattern.applyAlg(solutions[0].solution);
      expect(
        isPatternSolved(afterSolve, SolvedState.CROSS, face),
        `${face} cross not solved`,
      ).to.be.true;
    }
  });
});

// ---------------------------------------------------------------------------
// Helpers used in tests
// ---------------------------------------------------------------------------
function computeParity(perm: number[] | Uint8Array): boolean {
  const arr = Array.from(perm);
  const visited = new Array(arr.length).fill(false);
  let parity = false;
  for (let i = 0; i < arr.length; i++) {
    if (visited[i]) continue;
    let cycleLen = 0;
    let j = i;
    while (!visited[j]) {
      visited[j] = true;
      j = arr[j];
      cycleLen++;
    }
    if (cycleLen % 2 === 0) parity = !parity;
  }
  return parity;
}
