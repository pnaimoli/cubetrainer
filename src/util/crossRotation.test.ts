import { expect } from 'chai';
import { KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';
import { isPatternSolved } from './SolveChecker';
import { SolvedState } from './interfaces';
import { initCrossSolver, solveCross } from './crossSolver';
import { initXCrossSolver, solveXCross } from './xcrossSolver';
import { rankCrossSolutions } from './crossSolutionRanker';
import { translateMove, translateSlot, FACE_TO_D_ROTATION } from './crossRotation';

const SLOT_SOLVED_STATE: Record<string, SolvedState> = {
  FR: SolvedState.F2LFR,
  FL: SolvedState.F2LFL,
  BL: SolvedState.F2LBL,
  BR: SolvedState.F2LBR,
};

let kpuzzle: KPuzzle;

before(async () => {
  kpuzzle = await cube3x3x3.kpuzzle() as unknown as KPuzzle;
  initCrossSolver(kpuzzle);
  initXCrossSolver(kpuzzle);
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

  it('B (blue) cross: specific scramble produces correct 5-move optimal', () => {
    const scramble = "R B L' U2 B F' B' U L R' L B' F2 D2 U2";
    const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
    const solutions = solveCross(pattern, 'B');
    expect(solutions.length).to.be.greaterThan(0);
    expect(solutions[0].moveCount).to.equal(5);
    // Verify solutions using raw edge data (independent of isPatternSolved)
    // B cross edges: UB=2, BR=10, DB=6, BL=11
    const B_CROSS_EDGES = [2, 10, 6, 11];
    for (const sol of solutions) {
      const finalPattern = pattern.applyAlg(sol.solution);
      const edgeData = finalPattern.patternData['EDGES'];
      for (const idx of B_CROSS_EDGES) {
        expect(edgeData.pieces[idx], `Solution "${sol.solution}": edge at pos ${idx} should be piece ${idx}`).to.equal(idx);
        expect(edgeData.orientation[idx], `Solution "${sol.solution}": edge at pos ${idx} should have orientation 0`).to.equal(0);
      }
    }
  });

  it('B (blue) cross: ranked solutions (including gen-restricted) are valid', () => {
    const scramble = "L F R L' B L B2 U D' U2 L D L2 B2 F2";
    const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
    const solutions = solveCross(pattern, 'B');
    expect(solutions.length).to.be.greaterThan(0);

    const groups = rankCrossSolutions(solutions, pattern, 'B');
    expect(groups.length).to.be.greaterThan(0);

    // Verify every ranked solution (including gen-restricted) actually solves B cross.
    // The rotation label (e.g. "x", "x y'") puts B on D. Applying the rotation
    // to the scrambled pattern, then the display-frame solution, should solve D cross.
    for (const group of groups) {
      for (const ranked of group.solutions) {
        const rotatedPattern = pattern.applyAlg(ranked.rotation);
        const solvedPattern = rotatedPattern.applyAlg(ranked.solution);
        expect(
          isPatternSolved(solvedPattern, SolvedState.CROSS, 'D'),
          `${group.genCount}-gen "[${ranked.rotation}] ${ranked.solution}" should solve B cross`
        ).to.be.true;
      }
    }
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

describe('translateMove', () => {
  const MOVES = ['U', "U'", 'U2', 'D', "D'", 'D2', 'R', "R'", 'R2', 'L', "L'", 'L2', 'F', "F'", 'F2', 'B', "B'", 'B2'];

  for (const face of ['U', 'F', 'B', 'R', 'L']) {
    const rotation = FACE_TO_D_ROTATION[face];
    it(`${face} face (${rotation}): translated moves produce equivalent state`, () => {
      const scramble = "R U F' D2 L B' R2 U' F D L2 B R' U2 F'";

      for (const move of MOVES) {
        // Physical cube: scramble then move
        const physical = kpuzzle.defaultPattern().applyAlg(scramble).applyAlg(move);
        // Then rotate for display
        const physicalRotated = physical.applyAlg(rotation);

        // Display: scramble then rotation, then translated move
        const display = kpuzzle.defaultPattern().applyAlg(scramble).applyAlg(rotation);
        const translated = translateMove(move, rotation);
        const displayAfterMove = display.applyAlg(translated);

        // These must be identical
        expect(
          displayAfterMove.patternData['EDGES'].pieces,
          `${rotation}: move ${move} -> ${translated} edges should match`,
        ).to.deep.equal(physicalRotated.patternData['EDGES'].pieces);
        expect(
          displayAfterMove.patternData['CORNERS'].pieces,
          `${rotation}: move ${move} -> ${translated} corners should match`,
        ).to.deep.equal(physicalRotated.patternData['CORNERS'].pieces);
      }
    });
  }
});

describe('translateMove with y rotations', () => {
  const MOVES = ['U', "U'", 'U2', 'D', "D'", 'D2', 'R', "R'", 'R2', 'L', "L'", 'L2', 'F', "F'", 'F2', 'B', "B'", 'B2'];

  for (const composed of ['x y', "x y'", 'x y2', "x' y", 'z y']) {
    it(`composed rotation "${composed}": translated moves produce equivalent state`, () => {
      const scramble = "R U F' D2 L B' R2 U' F D L2 B R' U2 F'";

      for (const move of MOVES) {
        const physical = kpuzzle.defaultPattern().applyAlg(scramble).applyAlg(move);
        const physicalRotated = physical.applyAlg(composed);
        const display = kpuzzle.defaultPattern().applyAlg(scramble).applyAlg(composed);
        const translated = translateMove(move, composed);
        const displayAfterMove = display.applyAlg(translated);

        expect(
          displayAfterMove.patternData['EDGES'].pieces,
          `${composed}: move ${move} -> ${translated} edges should match`,
        ).to.deep.equal(physicalRotated.patternData['EDGES'].pieces);
        expect(
          displayAfterMove.patternData['CORNERS'].pieces,
          `${composed}: move ${move} -> ${translated} corners should match`,
        ).to.deep.equal(physicalRotated.patternData['CORNERS'].pieces);
      }
    });
  }
});

describe('translateSlot', () => {
  const ALL_SLOTS = ['FR', 'FL', 'BL', 'BR'];

  it('D face with no rotation is identity', () => {
    for (const slot of ALL_SLOTS) {
      expect(translateSlot(slot, 'D', '')).to.equal(slot);
    }
  });

  it('B face with x rotation swaps front/back', () => {
    expect(translateSlot('FR', 'B', 'x')).to.equal('BR');
    expect(translateSlot('FL', 'B', 'x')).to.equal('BL');
    expect(translateSlot('BL', 'B', 'x')).to.equal('FL');
    expect(translateSlot('BR', 'B', 'x')).to.equal('FR');
  });

  it('U face with x2 rotation swaps front/back', () => {
    expect(translateSlot('FR', 'U', 'x2')).to.equal('BR');
    expect(translateSlot('FL', 'U', 'x2')).to.equal('BL');
    expect(translateSlot('BL', 'U', 'x2')).to.equal('FL');
    expect(translateSlot('BR', 'U', 'x2')).to.equal('FR');
  });

  it('mapping is a permutation (bijective) for all faces', () => {
    for (const face of ['D', 'U', 'F', 'B', 'R', 'L']) {
      const rot = FACE_TO_D_ROTATION[face];
      const mapped = ALL_SLOTS.map(s => translateSlot(s, face, rot));
      expect(new Set(mapped).size).to.equal(4, `face ${face} mapping not bijective`);
    }
  });

  it('handles composed rotations (e.g. x y)', () => {
    // With x y, the belt faces rotate further
    const mapped = ALL_SLOTS.map(s => translateSlot(s, 'B', 'x y'));
    expect(new Set(mapped).size).to.equal(4);
  });
});

describe('XCross slot translation end-to-end', function() {
  this.timeout(10000);
  const NON_D_FACES = ['U', 'F', 'B', 'R', 'L'];

  for (const face of NON_D_FACES) {
    it(`${face} face: solved xcross slot maps to correct D-frame F2L pair`, () => {
      const scramble = "R U F' D2 L B' R2 U' F D L2 B R' U2 F'";
      const pattern = kpuzzle.defaultPattern().applyAlg(scramble);
      const solutions = solveXCross(pattern, face);
      expect(solutions.length).to.be.greaterThan(0);

      const sol = solutions[0];
      const solvedPattern = pattern.applyAlg(sol.solution);

      // Rotate to D-frame (same as checkXCrossSolved does)
      const rotation = FACE_TO_D_ROTATION[face];
      const rotatedPattern = solvedPattern.applyAlg(rotation);

      // The solver slot must be translated to D-frame slot for correct checking
      const dFrameSlot = translateSlot(sol.slot, face, rotation);
      const dFrameSlotState = SLOT_SOLVED_STATE[dFrameSlot];
      expect(dFrameSlotState, `D-frame slot "${dFrameSlot}" should have a SolvedState`).to.exist;

      // Verify the TRANSLATED slot is solved (this is what the app must do)
      expect(
        isPatternSolved(rotatedPattern, SolvedState.CROSS | dFrameSlotState, 'D'),
        `${face} face solver slot "${sol.slot}" -> D-frame "${dFrameSlot}" should be solved`
      ).to.be.true;

      // Verify using the RAW solver slot name would be wrong for non-trivial mappings
      if (dFrameSlot !== sol.slot) {
        const wrongSlotState = SLOT_SOLVED_STATE[sol.slot];
        expect(
          isPatternSolved(rotatedPattern, SolvedState.CROSS | wrongSlotState, 'D'),
          `Using raw solver slot "${sol.slot}" instead of "${dFrameSlot}" should fail`
        ).to.be.false;
      }
    });
  }
});
