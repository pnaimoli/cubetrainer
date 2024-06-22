import { expect } from 'chai';
import { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { isPatternSolved } from '../SolveChecker';
import { SolvedState } from '../interfaces';

describe('SolveChecker', () => {
  let kpuzzle: KPuzzle;

  before(() => {
    // Create a dummy KPuzzle with the name '3x3x3'
    kpuzzle = {
      definition: {
        name: '3x3x3',
        orbits: [
          { orbitName: 'EDGES', numPieces: 12, numOrientations: 2 },
          { orbitName: 'CORNERS', numPieces: 8, numOrientations: 3 },
          { orbitName: 'CENTERS', numPieces: 6, numOrientations: 1 },
        ],
      },
    } as KPuzzle;
  });

  it('isPatternSolved should return true for solved F2LFR state', async () => {
    // This is y R U R'
    const pattern: KPattern = new KPattern(kpuzzle, {
      EDGES: {
        pieces: [10, 2, 0, 1, 5, 6, 7, 4, 3, 8, 11, 9],
        orientation: [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1]
      },
      CORNERS: {
        pieces: [3, 2, 0, 7, 1, 4, 5, 6],
        orientation: [2, 0, 0, 2, 2, 0, 0, 0]
      },
      CENTERS: {
        pieces: [0, 2, 3, 4, 1, 5],
        orientation: [0, 0, 0, 0, 0, 0],
        orientationMod: [1, 1, 1, 1, 1, 1]
      }
    });

    expect(isPatternSolved(pattern, SolvedState.F2LFR)).to.equal(false, "FR");
    expect(isPatternSolved(pattern, SolvedState.F2LFL)).to.equal(true, "FL");
    expect(isPatternSolved(pattern, SolvedState.F2LBL)).to.equal(true, "BL");
    expect(isPatternSolved(pattern, SolvedState.F2LBR)).to.equal(true, "BR");
    expect(isPatternSolved(pattern, SolvedState.OLL)).to.equal(false, "OLL");
  });
});
