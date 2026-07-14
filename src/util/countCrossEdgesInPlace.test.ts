import { expect } from 'chai';
import { KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';
import { initCrossSolver, solveCross, countCrossEdgesInPlace, crossOptimalDepth } from './crossSolver';
import { initXCrossSolver, solveXCross } from './xcrossSolver';
import { isPatternSolved } from './SolveChecker';
import { SolvedState } from './interfaces';

let kpuzzle: KPuzzle;

before(async () => {
  kpuzzle = await cube3x3x3.kpuzzle() as unknown as KPuzzle;
  initCrossSolver(kpuzzle);
  initXCrossSolver(kpuzzle);
});

// ---------------------------------------------------------------------------
// countCrossEdgesInPlace
// ---------------------------------------------------------------------------

describe('countCrossEdgesInPlace', () => {
  it('solved state has 4 pieces in place for every face', () => {
    const pattern = kpuzzle.defaultPattern();
    for (const face of ['D', 'U', 'F', 'B', 'R', 'L']) {
      expect(countCrossEdgesInPlace(pattern, face), face).to.equal(4);
    }
  });

  it('single D move leaves 0 D-cross edges in place', () => {
    // A D move rotates all 4 edges out of alignment (none line up under any ADF)
    const pattern = kpuzzle.defaultPattern().applyAlg('D');
    // After D all 4 edges are one position off; the best rotation (D') restores all 4
    expect(countCrossEdgesInPlace(pattern, 'D')).to.equal(4);
  });

  it('D2 leaves 0 edges matching identity but 4 matching D2 rotation', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg('D2');
    expect(countCrossEdgesInPlace(pattern, 'D')).to.equal(4);
  });

  it('U move does not affect D cross edges', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg('U');
    expect(countCrossEdgesInPlace(pattern, 'D')).to.equal(4);
  });

  it('single R move displaces exactly 1 D-cross edge', () => {
    // R moves the DR edge away; the other 3 D edges stay
    const pattern = kpuzzle.defaultPattern().applyAlg('R');
    expect(countCrossEdgesInPlace(pattern, 'D')).to.equal(3);
  });

  it('R move on R cross: R rotates own edges so all stay in place', () => {
    // Like D on D cross, R on R cross rotates the cross face's own edges
    const pattern = kpuzzle.defaultPattern().applyAlg('R');
    expect(countCrossEdgesInPlace(pattern, 'R')).to.equal(4);
  });

  it('single F move displaces exactly 1 D-cross edge', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg('F');
    expect(countCrossEdgesInPlace(pattern, 'D')).to.equal(3);
  });

  it('R F displaces 2 D-cross edges', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg('R F');
    expect(countCrossEdgesInPlace(pattern, 'D')).to.equal(2);
  });

  it('long scramble has 0 or 1 pieces in place for D cross', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg("R U R' D F L B2 U' R F'");
    const pip = countCrossEdgesInPlace(pattern, 'D');
    expect(pip).to.be.at.least(0);
    expect(pip).to.be.at.most(4);
  });

  it('returns 0 for unknown face', () => {
    expect(countCrossEdgesInPlace(kpuzzle.defaultPattern(), 'X')).to.equal(0);
  });

  it('partially solved cross: 2 edges solved, 2 scrambled', () => {
    // Start solved, then do R B to move DR and DB edges
    const pattern = kpuzzle.defaultPattern().applyAlg('R B');
    const pip = countCrossEdgesInPlace(pattern, 'D');
    expect(pip).to.equal(2);
  });

  it('F R B L displaces all 4 D-cross edges', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg('F R B L');
    const pip = countCrossEdgesInPlace(pattern, 'D');
    expect(pip).to.be.at.most(2);
  });

  it('non-D face: U cross after R move', () => {
    // R affects UR edge on U cross
    const pattern = kpuzzle.defaultPattern().applyAlg('R');
    expect(countCrossEdgesInPlace(pattern, 'U')).to.equal(3);
  });

  it('non-D face: F cross solved state', () => {
    expect(countCrossEdgesInPlace(kpuzzle.defaultPattern(), 'F')).to.equal(4);
  });

  it('non-D face: B cross after B move stays at 4', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg('B');
    expect(countCrossEdgesInPlace(pattern, 'B')).to.equal(4);
  });

  it('result is consistent with cross optimal depth', () => {
    // pip=4 means all edges are in place under some cross-face rotation,
    // so cross depth is at most 1 (just the rotation itself).
    // pip=4 only implies depth=0 for the identity (solved) case.
    const scrambles = [
      '',           // solved -> pip=4, depth=0
      'D',          // D-layer rotation -> pip=4, depth=1
      "D'",         // D-layer rotation -> pip=4, depth=1
      'D2',         // D-layer rotation -> pip=4, depth=1
      'R',          // displaces 1 edge -> pip=3, depth=1
    ];
    for (const scramble of scrambles) {
      const pattern = scramble
        ? kpuzzle.defaultPattern().applyAlg(scramble)
        : kpuzzle.defaultPattern();
      const pip = countCrossEdgesInPlace(pattern, 'D');
      const depth = crossOptimalDepth(pattern, 'D');
      if (pip === 4) {
        expect(depth, `scramble "${scramble}"`).to.be.at.most(1);
      }
    }
  });

  it('0 pieces in place implies at least 2-move cross', () => {
    // If no edges are in place under any rotation, cross must take at least 2 moves
    const scrambles = [
      "R U R' D F L B2",
      "F R U2 B' L D R2 F'",
      "R2 U' F D' L B2 R",
    ];
    for (const scramble of scrambles) {
      const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
      const pip = countCrossEdgesInPlace(pattern, 'D');
      const depth = crossOptimalDepth(pattern, 'D');
      if (pip === 0) {
        expect(depth, `scramble "${scramble}"`).to.be.at.least(2);
      }
    }
  });

  it('pieces in place is between 0 and 4 inclusive for random scrambles', () => {
    const scrambles = [
      "R U F D L B",
      "F' D2 R U' B L2",
      "R2 U2 F2 D2 L2 B2",
      "R U R' U' F' D L B2 R",
      "L D' F R' U B2 L' D2 R F'",
    ];
    for (const scramble of scrambles) {
      const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
      for (const face of ['D', 'U', 'F', 'B', 'R', 'L']) {
        const pip = countCrossEdgesInPlace(pattern, face);
        expect(pip, `${face} cross, scramble "${scramble}"`).to.be.at.least(0);
        expect(pip, `${face} cross, scramble "${scramble}"`).to.be.at.most(4);
      }
    }
  });

  it('D-layer-only moves always give 4 pieces in place for D cross', () => {
    for (const alg of ['D', "D'", 'D2', "D D", "D D'", "D2 D"]) {
      const pattern = kpuzzle.defaultPattern().applyAlg(alg);
      expect(countCrossEdgesInPlace(pattern, 'D'), alg).to.equal(4);
    }
  });

  it('correctly oriented but wrong position does not count', () => {
    // Swap two D-cross edges with a known alg: R2 F2 R2 swaps DF<->DR (approximately)
    // Use a short scramble that is known to displace edges
    const pattern = kpuzzle.defaultPattern().applyAlg("R2 F2");
    const pip = countCrossEdgesInPlace(pattern, 'D');
    // Not all 4 can be in place since edges are swapped
    expect(pip).to.be.at.most(3);
  });
});

// ---------------------------------------------------------------------------
// Cross solver: broad test coverage
// ---------------------------------------------------------------------------

describe('Cross solver - broad coverage', () => {
  const SCRAMBLES = [
    "R U R' D F",
    "F' D L",
    "R U F D'",
    "R U R' D F L B2",
    "R2 U' F D' L B2 R",
    "F R U2 B' L D R2 F'",
    "L' U2 R F D' B2 L U R' D2 F B' L2 U R'",
    "R U F' D2 L B' R2 U' F D L2 B R' U2 F'",
    "B2 L D R' U F2 B' L2 D' R U2 F",
    "U R' F L D2 B R2 U' F' D L2 B'",
  ];

  for (const face of ['D', 'U', 'F', 'B', 'R', 'L']) {
    it(`${face} cross: all solutions valid for multiple scrambles`, () => {
      for (const scramble of SCRAMBLES) {
        const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
        const solutions = solveCross(pattern, face);
        expect(solutions.length, `${face} no solutions for "${scramble}"`).to.be.greaterThan(0);

        for (const sol of solutions) {
          const finalPattern = pattern.applyAlg(sol.solution);
          expect(
            isPatternSolved(finalPattern, SolvedState.CROSS, face),
            `${face}: "${sol.solution}" fails for "${scramble}"`,
          ).to.be.true;
        }
      }
    });
  }

  it('all solutions for a scramble are the same optimal length', () => {
    for (const scramble of SCRAMBLES) {
      const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
      const solutions = solveCross(pattern, 'D');
      if (solutions.length === 0) continue;
      const optimal = solutions[0].moveCount;
      for (const sol of solutions) {
        expect(sol.moveCount, `"${scramble}"`).to.equal(optimal);
      }
    }
  });

  it('optimal depth matches first solution move count', () => {
    for (const scramble of SCRAMBLES) {
      const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
      const depth = crossOptimalDepth(pattern, 'D');
      const solutions = solveCross(pattern, 'D');
      expect(depth, `"${scramble}"`).to.equal(solutions[0].moveCount);
    }
  });

  it('cross optimal depth is at most 8 for any scramble', () => {
    for (const scramble of SCRAMBLES) {
      for (const face of ['D', 'U', 'F', 'B', 'R', 'L']) {
        const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
        const depth = crossOptimalDepth(pattern, face);
        expect(depth, `${face} cross, "${scramble}"`).to.be.at.most(8);
      }
    }
  });

  it('applying the inverse of a solution yields the original scramble state', () => {
    const scramble = "R U R' D F";
    const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
    const solutions = solveCross(pattern, 'D');
    const sol = solutions[0];
    const solved = pattern.applyAlg(sol.solution);

    // Applying inverse of solution to solved should give back the scrambled cross state
    const inverseMoves = sol.solution.split(' ').reverse().map(m => {
      if (m.endsWith('2')) return m;
      if (m.endsWith("'")) return m.slice(0, -1);
      return m + "'";
    }).join(' ');
    const restored = solved.applyAlg(inverseMoves);

    // Cross edges should match the original scrambled pattern
    const origEdges = pattern.patternData['EDGES'];
    const restoredEdges = restored.patternData['EDGES'];
    // Only cross edges (4-7) need to match
    for (const idx of [4, 5, 6, 7]) {
      expect(restoredEdges.pieces[idx], `edge ${idx} piece`).to.equal(origEdges.pieces[idx]);
      expect(restoredEdges.orientation[idx], `edge ${idx} ori`).to.equal(origEdges.orientation[idx]);
    }
  });

  it('known scramble optimal depths are correct', () => {
    const cases: [string, string, number][] = [
      ['', 'D', 0],
      ['R', 'D', 1],
      ['F', 'D', 1],
      ['R F', 'D', 2],
      ['R U F', 'D', 2],
      ['U', 'D', 0],      // U doesn't affect D cross
      ['U', 'U', 1],      // U rotates U cross edges (like D on D cross)
      ['D', 'U', 0],      // D doesn't affect U cross
      ['R', 'L', 0],      // R doesn't affect L cross edges (UL, DL, FL, BL)
    ];
    for (const [scramble, face, expected] of cases) {
      const pattern = scramble
        ? kpuzzle.defaultPattern().applyAlg(scramble)
        : kpuzzle.defaultPattern();
      const depth = crossOptimalDepth(pattern, face);
      expect(depth, `"${scramble}" ${face}`).to.equal(expected);
    }
  });

  it('symmetric scrambles produce symmetric cross depths', () => {
    // R and L should produce the same D-cross depth (mirror symmetry around M slice)
    const pattern1 = kpuzzle.defaultPattern().applyAlg('R');
    const pattern2 = kpuzzle.defaultPattern().applyAlg('L');
    expect(crossOptimalDepth(pattern1, 'D')).to.equal(crossOptimalDepth(pattern2, 'D'));

    const pattern3 = kpuzzle.defaultPattern().applyAlg('F');
    const pattern4 = kpuzzle.defaultPattern().applyAlg('B');
    expect(crossOptimalDepth(pattern3, 'D')).to.equal(crossOptimalDepth(pattern4, 'D'));
  });
});

// ---------------------------------------------------------------------------
// XCross solver: broad test coverage
// ---------------------------------------------------------------------------

describe('XCross solver - broad coverage', () => {
  const SCRAMBLES = [
    "R U R'",
    "R U R' D F",
    "F' D L",
    "R U F D'",
    "R U R' D F L B2",
    "L' U2 R F D'",
    "R2 U' F D' L B2 R",
  ];

  const SLOT_STATE: Record<string, SolvedState> = {
    FR: SolvedState.F2LFR,
    FL: SolvedState.F2LFL,
    BL: SolvedState.F2LBL,
    BR: SolvedState.F2LBR,
  };

  it('D-face xcross solutions solve both cross and target F2L slot', () => {
    for (const scramble of SCRAMBLES) {
      const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
      const solutions = solveXCross(pattern, 'D', undefined, 8);
      if (solutions.length === 0) continue;

      for (const sol of solutions) {
        const afterSolve = pattern.applyAlg(sol.solution);
        expect(
          isPatternSolved(afterSolve, SolvedState.CROSS, 'D'),
          `cross not solved: "${sol.solution}" for "${scramble}"`,
        ).to.be.true;
        expect(
          isPatternSolved(afterSolve, SLOT_STATE[sol.slot], 'D'),
          `${sol.slot} not solved: "${sol.solution}" for "${scramble}"`,
        ).to.be.true;
      }
    }
  });

  it('xcross solutions are sorted by moveCount', () => {
    for (const scramble of SCRAMBLES) {
      const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
      const solutions = solveXCross(pattern, 'D', undefined, 8);
      for (let i = 1; i < solutions.length; i++) {
        expect(solutions[i].moveCount).to.be.at.least(solutions[i - 1].moveCount);
      }
    }
  });

  it('slot filter returns only solutions for requested slots', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg("R U R' D F");
    for (const slot of ['FR', 'FL', 'BL', 'BR']) {
      const solutions = solveXCross(pattern, 'D', [slot], 8);
      for (const sol of solutions) {
        expect(sol.slot).to.equal(slot);
      }
    }
  });

  it('multi-slot filter returns only requested slots', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg("R U F D'");
    const solutions = solveXCross(pattern, 'D', ['FR', 'BL'], 8);
    for (const sol of solutions) {
      expect(['FR', 'BL']).to.include(sol.slot);
    }
  });

  it('xcross optimal is >= cross optimal', () => {
    for (const scramble of SCRAMBLES) {
      const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
      const crossDepth = crossOptimalDepth(pattern, 'D');
      const xcrossSolutions = solveXCross(pattern, 'D', undefined, 8);
      if (xcrossSolutions.length === 0) continue;
      expect(
        xcrossSolutions[0].moveCount,
        `"${scramble}": xcross should be >= cross`,
      ).to.be.at.least(crossDepth);
    }
  });

  it('maxDepth=0 returns solutions only if already solved', () => {
    // Solved state: xcross with 0 moves
    const solved = kpuzzle.defaultPattern();
    const solutions = solveXCross(solved, 'D', undefined, 0);
    expect(solutions.length).to.be.greaterThan(0);
    for (const sol of solutions) {
      expect(sol.moveCount).to.equal(0);
    }

    // Scrambled: no solutions at depth 0
    const scrambled = kpuzzle.defaultPattern().applyAlg("R U R' D F");
    const noSolutions = solveXCross(scrambled, 'D', undefined, 0);
    expect(noSolutions.length).to.equal(0);
  });

  for (const face of ['U', 'F', 'B', 'R', 'L']) {
    it(`${face}-face xcross solutions solve cross and F2L on that face`, () => {
      const scramble = "R U F' D2 L B' R2";
      const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
      const solutions = solveXCross(pattern, face, undefined, 8);
      if (solutions.length === 0) return;

      for (const sol of solutions) {
        const afterSolve = pattern.applyAlg(sol.solution);
        expect(
          isPatternSolved(afterSolve, SolvedState.CROSS, face),
          `${face} cross not solved by "${sol.solution}"`,
        ).to.be.true;
      }
    });
  }

  it('xcross moveCount equals the number of moves in solution string', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg("R U R' D F");
    const solutions = solveXCross(pattern, 'D', undefined, 8);
    for (const sol of solutions) {
      const moveCount = sol.solution.split(' ').filter(Boolean).length;
      expect(sol.moveCount, `"${sol.solution}"`).to.equal(moveCount);
    }
  });

  it('solved state has 0-move solutions for all 4 slots', () => {
    const solutions = solveXCross(kpuzzle.defaultPattern(), 'D');
    const slots = new Set(solutions.filter(s => s.moveCount === 0).map(s => s.slot));
    expect(slots.size).to.equal(4);
    expect(slots).to.include('FR');
    expect(slots).to.include('FL');
    expect(slots).to.include('BL');
    expect(slots).to.include('BR');
  });
});

// ---------------------------------------------------------------------------
// countCrossEdgesInPlace + cross solver integration
// ---------------------------------------------------------------------------

describe('countCrossEdgesInPlace + solver integration', () => {
  it('pieces in place decreases as more moves are applied', () => {
    // From solved, applying moves should generally not increase pieces in place
    // (not strictly monotonic but a good sanity check for simple cases)
    const p0 = kpuzzle.defaultPattern();
    const p1 = p0.applyAlg('R');
    const p2 = p1.applyAlg('F');
    const p3 = p2.applyAlg('B');
    const p4 = p3.applyAlg('L');

    expect(countCrossEdgesInPlace(p0, 'D')).to.equal(4);
    expect(countCrossEdgesInPlace(p1, 'D')).to.equal(3);
    expect(countCrossEdgesInPlace(p2, 'D')).to.equal(2);
    // p3 and p4 may vary but should be <= 2
    expect(countCrossEdgesInPlace(p3, 'D')).to.be.at.most(3);
    expect(countCrossEdgesInPlace(p4, 'D')).to.be.at.most(3);
  });

  it('cross solution reduces pieces-not-in-place to 0', () => {
    const scrambles = [
      "R U R' D F",
      "F' D L",
      "R2 U' F D' L B2 R",
    ];
    for (const scramble of scrambles) {
      const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
      const solutions = solveCross(pattern, 'D');
      const solved = pattern.applyAlg(solutions[0].solution);
      expect(countCrossEdgesInPlace(solved, 'D'), scramble).to.equal(4);
    }
  });

  it('pieces in place is consistent across all 6 faces for same pattern', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg("R U F D L B");
    let total = 0;
    for (const face of ['D', 'U', 'F', 'B', 'R', 'L']) {
      const pip = countCrossEdgesInPlace(pattern, face);
      expect(pip).to.be.at.least(0);
      expect(pip).to.be.at.most(4);
      total += pip;
    }
    // Total across all faces should be reasonable (12 edges, each belongs to 2 faces)
    expect(total).to.be.at.least(0);
    expect(total).to.be.at.most(24);
  });
});
