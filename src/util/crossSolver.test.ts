import { expect } from 'chai';
import { KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';
import { isPatternSolved } from './SolveChecker';
import { SolvedState } from './interfaces';
import { initCrossSolver, solveCross } from './crossSolver';

let kpuzzle: KPuzzle;

before(async () => {
  kpuzzle = await cube3x3x3.kpuzzle() as unknown as KPuzzle;
  initCrossSolver(kpuzzle);
});

describe('Cross Solver', () => {
  it('solved state returns 0 moves', () => {
    const solutions = solveCross(kpuzzle.defaultPattern());
    expect(solutions.length).to.be.greaterThan(0);
    expect(solutions[0].moveCount).to.equal(0);
  });

  it('single D move: solution is D\'', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg('D');
    const solutions = solveCross(pattern);
    expect(solutions[0].moveCount).to.equal(1);
    expect(solutions.some(s => s.solution === "D'")).to.be.true;
  });

  it('single R move: solution is R\'', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg('R');
    const solutions = solveCross(pattern);
    expect(solutions[0].moveCount).to.equal(1);
    expect(solutions.some(s => s.solution === "R'")).to.be.true;
  });

  it('D2 scramble: solution is D2', () => {
    const solutions = solveCross(kpuzzle.defaultPattern().applyAlg('D2'));
    expect(solutions[0].moveCount).to.equal(1);
    expect(solutions.some(s => s.solution === "D2")).to.be.true;
  });

  it('R D scramble: optimal is 2 moves', () => {
    const solutions = solveCross(kpuzzle.defaultPattern().applyAlg('R D'));
    expect(solutions[0].moveCount).to.equal(2);
  });

  it('U move does not affect cross', () => {
    const solutions = solveCross(kpuzzle.defaultPattern().applyAlg('U'));
    expect(solutions[0].moveCount).to.equal(0);
  });

  it('every solution actually solves the cross', () => {
    const scrambles = [
      'D', "D'", 'D2',
      'R', "R'",
      'R D', "F' D2",
      'R U F',
      "R U R' D F",
      "R U R' D F L B2",
      "R2 U' F D' L B2 R",
      "F R U2 B' L D R2 F'",
    ];

    for (const scramble of scrambles) {
      const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
      const solutions = solveCross(pattern);
      expect(solutions.length, `no solutions for "${scramble}"`).to.be.greaterThan(0);

      for (const sol of solutions) {
        const afterSolve = pattern.applyAlg(sol.solution);
        const crossSolved = isPatternSolved(afterSolve, SolvedState.CROSS);
        expect(crossSolved, `"${sol.solution}" doesn't solve cross after "${scramble}"`).to.be.true;
      }
    }
  });

  it('multiple solutions are all optimal', () => {
    const pattern = kpuzzle.defaultPattern().applyAlg("R U R' D F");
    const solutions = solveCross(pattern);
    const optimal = solutions[0].moveCount;
    for (const sol of solutions) {
      expect(sol.moveCount).to.equal(optimal);
    }
  });
});
