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

describe('Cross solving per face', () => {
  const ALL_FACES = ['D', 'U', 'F', 'B', 'R', 'L'];

  for (const face of ALL_FACES) {
    it(`solved state has 0-move ${face} cross`, () => {
      const solutions = solveCross(kpuzzle.defaultPattern(), face);
      expect(solutions.length).to.be.greaterThan(0);
      expect(solutions[0].moveCount).to.equal(0);
    });
  }

  for (const face of ALL_FACES) {
    it(`${face} cross: solutions actually solve the cross`, () => {
      const scramble = "R U F' D2 L B' R2 U' F D L2 B R' U2 F'";
      const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
      const solutions = solveCross(pattern, face);
      expect(solutions.length).to.be.greaterThan(0);

      for (const sol of solutions) {
        const finalPattern = pattern.applyAlg(sol.solution);
        const isSolved = isPatternSolved(finalPattern, SolvedState.CROSS, face);
        expect(isSolved, `Solution "${sol.solution}" should solve ${face} cross`).to.be.true;
      }
    });
  }

  for (const face of ALL_FACES) {
    it(`${face} cross: second scramble all solutions valid`, () => {
      const scramble = "L' U2 R F D' B2 L U R' D2 F B' L2 U R'";
      const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
      const solutions = solveCross(pattern, face);
      expect(solutions.length).to.be.greaterThan(0);

      for (const sol of solutions) {
        const finalPattern = pattern.applyAlg(sol.solution);
        expect(isPatternSolved(finalPattern, SolvedState.CROSS, face)).to.be.true;
      }
    });
  }

  it('D cross is unchanged from original behavior', () => {
    const scramble = "R U F' D2 L B' R2 U' F D L2 B R' U2 F'";
    const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
    const solutions = solveCross(pattern, 'D');
    const solutionsDefault = solveCross(pattern);
    expect(solutions.length).to.equal(solutionsDefault.length);
    expect(solutions[0].moveCount).to.equal(solutionsDefault[0].moveCount);
  });

  it('different faces produce different solutions for same scramble', () => {
    const scramble = "R U F' D2 L B' R2 U' F D L2 B R' U2 F'";
    const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
    const dSolutions = solveCross(pattern, 'D');
    const uSolutions = solveCross(pattern, 'U');
    // Move counts should generally differ (extremely unlikely to be equal for a random scramble)
    const dMoves = new Set(dSolutions.map(s => s.solution));
    const uMoves = new Set(uSolutions.map(s => s.solution));
    // At least one solution should differ
    const overlap = [...dMoves].filter(s => uMoves.has(s));
    expect(overlap.length).to.be.lessThan(dMoves.size);
  });
});
