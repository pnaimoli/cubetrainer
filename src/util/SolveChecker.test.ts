import { expect } from 'chai';
import { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { isPatternSolved } from './SolveChecker';
import { SolvedState } from './interfaces';

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

  it("Check the state of the cube for a 3 move insert (y R U R')", async () => {
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
    expect(isPatternSolved(pattern, SolvedState.FULL)).to.equal(false, "FULL");
  });

  it("Check the state of the cube for a T OLL (z x F R U R' U' F')", async () => {
    // This is y R U R'
    const pattern: KPattern = new KPattern(kpuzzle, {
      EDGES: {
        pieces: [9, 8, 0, 4, 10, 2, 11, 6, 1, 5, 3, 7],
        orientation: [1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1]
      },
      CORNERS: {
        pieces: [4, 5, 3, 0, 1, 7, 6, 2],
        orientation: [0, 0, 2, 1, 2, 1, 2, 1]
      },
      CENTERS: {
        pieces: [2, 5, 3, 0, 1, 4],
        orientation: [0, 0, 0, 0, 0, 0],
        orientationMod: [1, 1, 1, 1, 1, 1]
      }
    });

    expect(isPatternSolved(pattern, SolvedState.F2L)).to.equal(true, "F2L");
    expect(isPatternSolved(pattern, SolvedState.OLL)).to.equal(false, "OLL");
    expect(isPatternSolved(pattern, SolvedState.FULL)).to.equal(false, "FULL");
  });

  it("Check the state of the cube for an Aa Perm (z y x' R U' R' D R U R' D' R U R' D R U' R' D' x)", async () => {
    // This is y R U R'
    const pattern: KPattern = new KPattern(kpuzzle, {
      EDGES: {
        pieces: [3, 11, 7, 9, 1, 10, 5, 8, 2, 0, 6, 4],
        orientation: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]
      },
      CORNERS: {
        pieces: [6, 2, 3, 5, 1, 0, 4, 7],
        orientation: [1, 2, 1, 2, 1, 2, 1, 2]
      },
      CENTERS: {
        pieces: [1, 2, 0, 4, 5, 3],
        orientation: [0, 0, 0, 0, 0, 0],
        orientationMod: [1, 1, 1, 1, 1, 1]
      }
    });

    expect(isPatternSolved(pattern, SolvedState.F2L)).to.equal(true, "F2L");
    expect(isPatternSolved(pattern, SolvedState.OLL)).to.equal(true, "OLL");
    expect(isPatternSolved(pattern, SolvedState.FULL)).to.equal(false, "FULL");
  });
});
