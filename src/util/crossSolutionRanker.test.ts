import { expect } from 'chai';
import { rankCrossSolutions } from './crossSolutionRanker';
import { CrossSolution } from './crossSolver';

describe('crossSolutionRanker', () => {
  it('returns empty array for empty input', () => {
    expect(rankCrossSolutions([])).to.deep.equal([]);
  });

  it('returns empty array for solved-only input', () => {
    const solutions: CrossSolution[] = [{ moveCount: 0, solution: '' }];
    expect(rankCrossSolutions(solutions)).to.deep.equal([]);
  });

  it('groups optimal solutions by best gen count', () => {
    const solutions: CrossSolution[] = [
      { moveCount: 4, solution: "R U F D" },
    ];
    const groups = rankCrossSolutions(solutions);
    expect(groups.length).to.be.greaterThan(0);
    for (const g of groups) {
      expect(g.genCount).to.be.greaterThan(0);
      expect(g.solutions.length).to.be.greaterThan(0);
    }
  });

  it('deduplicates y-rotation equivalent solutions', () => {
    // L U D and R U D are NOT rotation equivalents (different solutions)
    // But L U D under y' becomes F U D, which is distinct from R U D
    const solutions: CrossSolution[] = [
      { moveCount: 3, solution: "R U D" },
      { moveCount: 3, solution: "L U D" },
    ];
    const groups = rankCrossSolutions(solutions);
    const allSolutions = groups.flatMap(g => g.solutions);
    // Should not have duplicate rewritten strings
    const strings = allSolutions.map(s => s.solution);
    expect(new Set(strings).size).to.equal(strings.length);
  });

  it('prefers solutions without L/B moves', () => {
    const solutions: CrossSolution[] = [
      { moveCount: 3, solution: "L U D" },
    ];
    const groups = rankCrossSolutions(solutions);
    // Under y', L->F, so best rotation should be "F U D" (no L/B)
    const bestGroup = groups[0];
    const firstSol = bestGroup.solutions[0];
    const lbCount = firstSol.solution.split(' ')
      .filter(m => m.charAt(0) === 'L' || m.charAt(0) === 'B').length;
    expect(lbCount).to.equal(0);
  });

  it('picks best rotation per solution (avoids showing rotation equivalents)', () => {
    // D' L F2 L D2 F' D' should be shown as D' F R2 F D2 R' D' (via y' rotation)
    // or similar rotation that avoids L/B
    const solutions: CrossSolution[] = [
      { moveCount: 7, solution: "D' L F2 L D2 F' D'" },
    ];
    const groups = rankCrossSolutions(solutions);
    const allSolutions = groups.flatMap(g => g.solutions);
    // Should only have ONE solution (the best rotation), not 4
    expect(allSolutions.length).to.equal(1);
    // That solution should prefer R/F over L/B
    const sol = allSolutions[0];
    const hasL = sol.solution.includes('L');
    const hasB = sol.solution.includes('B');
    // At least one of L or B should be eliminated by rotation
    expect(hasL && hasB).to.be.false;
  });

  it('groups are sorted by genCount DESC (highest first)', () => {
    const solutions: CrossSolution[] = [
      { moveCount: 4, solution: "R U F D" },
    ];
    const groups = rankCrossSolutions(solutions);
    for (let i = 1; i < groups.length; i++) {
      expect(groups[i].genCount).to.be.lessThanOrEqual(groups[i - 1].genCount);
    }
  });

  it('deduplicates U D under all rotations to single entry', () => {
    const solutions: CrossSolution[] = [
      { moveCount: 2, solution: "U D" },
    ];
    const groups = rankCrossSolutions(solutions);
    const allSolutions = groups.flatMap(g => g.solutions);
    const udEntries = allSolutions.filter(r => r.solution === "U D");
    expect(udEntries.length).to.equal(1);
  });
});
