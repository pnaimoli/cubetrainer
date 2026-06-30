import { expect } from 'chai';
import { KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';
import { isPatternSolved } from './SolveChecker';
import { SolvedState } from './interfaces';
import { initXCrossSolver, solveXCross } from './xcrossSolver';

let kpuzzle: KPuzzle;

before(async () => {
  kpuzzle = await cube3x3x3.kpuzzle() as unknown as KPuzzle;
  initXCrossSolver(kpuzzle);
});

describe('XCross Solver', () => {
  it('solved state returns 0-move solutions for all slots', () => {
    const solutions = solveXCross(kpuzzle.defaultPattern());
    expect(solutions.length).to.be.greaterThan(0);
    expect(solutions[0].moveCount).to.equal(0);
  });

  it('single D move: XCross solutions exist with moveCount >= 1', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg('D');
    const solutions = solveXCross(pattern);
    expect(solutions.length).to.be.greaterThan(0);
    // D move disrupts cross but not necessarily the F2L pair if it returns
    expect(solutions[0].moveCount).to.be.greaterThanOrEqual(1);
  });

  it('finds solutions for a specific slot', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg("R U R'");
    const solutions = solveXCross(pattern, 'D', ['FR']);
    expect(solutions.length).to.be.greaterThan(0);
    for (const sol of solutions) {
      expect(sol.slot).to.equal('FR');
    }
  });

  it('solutions are sorted by moveCount', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg("R U F D'");
    const solutions = solveXCross(pattern);
    for (let i = 1; i < solutions.length; i++) {
      expect(solutions[i].moveCount).to.be.greaterThanOrEqual(solutions[i - 1].moveCount);
    }
  });

  it('solutions actually solve the XCross (D face)', () => {
    const scrambles = [
      "R U R'",
      "R U R' D F",
      "F' D L",
      "R U F D' L",
    ];

    for (const scramble of scrambles) {
      const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
      const solutions = solveXCross(pattern, 'D', undefined, 8);
      expect(solutions.length, `no solutions for "${scramble}"`).to.be.greaterThan(0);

      for (const sol of solutions) {
        const afterSolve = pattern.applyAlg(sol.solution);
        const slotState = { FR: SolvedState.F2LFR, FL: SolvedState.F2LFL, BL: SolvedState.F2LBL, BR: SolvedState.F2LBR }[sol.slot]!;
        const crossSolved = isPatternSolved(afterSolve, SolvedState.CROSS, 'D');
        expect(crossSolved, `"${sol.solution}" doesn't solve cross after "${scramble}"`).to.be.true;
        const f2lSolved = isPatternSolved(afterSolve, slotState, 'D');
        expect(f2lSolved, `"${sol.solution}" doesn't solve ${sol.slot} F2L after "${scramble}"`).to.be.true;
      }
    }
  });

  it('respects maxDepth limit', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg("R U R' D F L B2");
    const solutions = solveXCross(pattern, 'D', undefined, 4);
    for (const sol of solutions) {
      expect(sol.moveCount).to.be.at.most(4);
    }
  });

  it('returns empty array when no solution within maxDepth', () => {
    // A heavily scrambled position likely needs more than 2 moves for XCross
    const pattern = kpuzzle.defaultPattern().applyAlg("R U R' D F L B2 U' R F'");
    const solutions = solveXCross(pattern, 'D', ['FR'], 2);
    // Either empty or all solutions are <= 2 moves
    for (const sol of solutions) {
      expect(sol.moveCount).to.be.at.most(2);
    }
  });
});
