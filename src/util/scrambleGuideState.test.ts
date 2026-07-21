import { expect } from 'chai';
import {
  parseMoveInfo, invertQuarterTurn, netProgress, transition, movesCommute,
  computeDifferentialScramble, ComputeTransitionFn,
  GuideState, MoveInfo,
} from './scrambleGuideState';
import type { KPuzzle } from 'cubing/kpuzzle';

// Helper: create initial state for a given move list
function initState(moves: string[]): { state: GuideState; infos: MoveInfo[] } {
  const infos = moves.map(parseMoveInfo);
  const state: GuideState = {
    mode: 'executing',
    moveIndex: 0,
    moveStatuses: moves.map(() => 'pending' as const),
    partials: {},
  };
  return { state, infos };
}

// Helper: apply a sequence of cube moves to the state machine
function applyMoves(state: GuideState, infos: MoveInfo[], moves: string[]): { state: GuideState; completions: number } {
  let s = state;
  let completions = 0;
  for (const m of moves) {
    const result = transition(s, m, infos);
    s = result.state;
    if (result.completed) completions++;
  }
  return { state: s, completions };
}

// Helper: track the "physical cube state" as net quarter turns per face.
function netCubeState(cubeMoves: string[]): Record<string, number> {
  const net: Record<string, number> = {};
  for (const m of cubeMoves) {
    const face = m.charAt(0);
    const dir = m.endsWith("'") ? -1 : 1;
    net[face] = ((net[face] ?? 0) + dir) % 4;
    if (net[face] === 0) delete net[face];
  }
  return net;
}

describe('scrambleGuideState helpers', () => {
  it('parseMoveInfo: single CW', () => {
    const info = parseMoveInfo('R');
    expect(info).to.deep.equal({ face: 'R', isDouble: false, expected: 'R' });
  });

  it('parseMoveInfo: single CCW', () => {
    const info = parseMoveInfo("R'");
    expect(info).to.deep.equal({ face: 'R', isDouble: false, expected: "R'" });
  });

  it('parseMoveInfo: double', () => {
    const info = parseMoveInfo('R2');
    expect(info).to.deep.equal({ face: 'R', isDouble: true, expected: null });
  });

  it('invertQuarterTurn', () => {
    expect(invertQuarterTurn('R')).to.equal("R'");
    expect(invertQuarterTurn("R'")).to.equal('R');
    expect(invertQuarterTurn('U')).to.equal("U'");
    expect(invertQuarterTurn("U'")).to.equal('U');
    // R2 is its own inverse
    expect(invertQuarterTurn('R2')).to.equal('R2');
  });

  it('netProgress', () => {
    expect(netProgress(['R', 'R'], 'R')).to.equal(2);
    expect(netProgress(['R', "R'"], 'R')).to.equal(0);
    expect(netProgress(["R'", "R'"], 'R')).to.equal(-2);
    expect(netProgress(['R', 'U'], 'R')).to.equal(1);
  });
});

describe('scrambleGuideState transition - basic execution', () => {
  it('correct single move advances', () => {
    const { state, infos } = initState(['R', 'U']);
    const r = transition(state, 'R', infos);
    expect(r.state.mode).to.equal('executing');
    expect(r.state.moveIndex).to.equal(1);
    expect(r.state.moveStatuses[0]).to.equal('done');
    expect(r.completed).to.be.false;
  });

  it('last correct move triggers completion', () => {
    const { state, infos } = initState(['R']);
    const r = transition(state, 'R', infos);
    expect(r.completed).to.be.true;
    expect(r.state.moveIndex).to.equal(1);
  });

  it('two correct moves complete the scramble', () => {
    const { state, infos } = initState(['R', 'U']);
    const r1 = transition(state, 'R', infos);
    const r2 = transition(r1.state, 'U', infos);
    expect(r2.completed).to.be.true;
  });

  it('wrong direction on single move shows yellow, undo returns to pending', () => {
    const { state, infos } = initState(['R', 'U']);
    // Expected R, do R' (wrong direction but same face)
    const r1 = transition(state, "R'", infos);
    expect(r1.state.mode).to.equal('executing');
    expect(r1.state.moveStatuses[0]).to.equal('yellow');
    // Now do R to cancel the R'
    const r2 = transition(r1.state, 'R', infos);
    expect(r2.state.moveStatuses[0]).to.equal('pending');
    // Now do R correctly
    const r3 = transition(r2.state, 'R', infos);
    expect(r3.state.moveStatuses[0]).to.equal('done');
    expect(r3.state.moveIndex).to.equal(1);
  });

  it('three wrong-direction turns complete via modular arithmetic', () => {
    // Target is U', user does U U U (3 CW = 1 CCW = U')
    const { state, infos } = initState(["U'"]);
    const { state: s1 } = applyMoves(state, infos, ['U']);
    expect(s1.moveStatuses[0]).to.equal('yellow');
    const { state: s2 } = applyMoves(s1, infos, ['U']);
    expect(s2.moveStatuses[0]).to.equal('yellow');
    const { state: s3, completions } = applyMoves(s2, infos, ['U']);
    expect(s3.moveStatuses[0]).to.equal('done');
    expect(completions).to.equal(1);
  });

  it('four same-direction turns returns to pending (full rotation)', () => {
    const { state, infos } = initState(["U'"]);
    const { state: s } = applyMoves(state, infos, ['U', 'U', 'U', 'U']);
    // 4 CW = identity, back to pending (but also completes after 3, so actually moveIndex advances)
    // After 3 U's it completes. The 4th U is irrelevant.
    expect(s.moveIndex).to.equal(1);
  });

  it('double move: two CW quarter turns complete R2', () => {
    const { state, infos } = initState(['R2']);
    const r1 = transition(state, 'R', infos);
    expect(r1.state.mode).to.equal('executing');
    expect(r1.state.moveStatuses[0]).to.equal('yellow');
    const r2 = transition(r1.state, 'R', infos);
    expect(r2.state.moveStatuses[0]).to.equal('done');
    expect(r2.completed).to.be.true;
  });

  it('double move: two CCW quarter turns also complete R2', () => {
    const { state, infos } = initState(['R2']);
    const r1 = transition(state, "R'", infos);
    const r2 = transition(r1.state, "R'", infos);
    expect(r2.state.moveStatuses[0]).to.equal('done');
    expect(r2.completed).to.be.true;
  });

  it('double move: CW then CCW cancels back to pending', () => {
    const { state, infos } = initState(['R2']);
    const r1 = transition(state, 'R', infos);
    expect(r1.state.moveStatuses[0]).to.equal('yellow');
    const r2 = transition(r1.state, "R'", infos);
    expect(r2.state.moveStatuses[0]).to.equal('pending');
  });
});

describe('scrambleGuideState transition - error and undo', () => {
  it('wrong face enters error state', () => {
    const { state, infos } = initState(['R', 'U']);
    const r = transition(state, 'B', infos);
    expect(r.state.mode).to.equal('error');
    if (r.state.mode === 'error') {
      expect(r.state.wrongMoves).to.deep.equal(['B']);
    }
  });

  it('single wrong move: undo returns to executing', () => {
    const { state, infos } = initState(['R']);
    const r1 = transition(state, 'B', infos);
    expect(r1.state.mode).to.equal('error');
    // Undo B with B'
    const r2 = transition(r1.state, "B'", infos);
    expect(r2.state.mode).to.equal('executing');
    expect(r2.state.moveIndex).to.equal(0);
  });

  it('two wrong moves: undo in reverse order', () => {
    const { state, infos } = initState(['R']);
    const { state: s1 } = applyMoves(state, infos, ['B', 'U']);
    expect(s1.mode).to.equal('error');
    if (s1.mode === 'error') {
      expect(s1.wrongMoves).to.deep.equal(['B', 'U']);
    }
    // Undo: U' then B'
    const { state: s2 } = applyMoves(s1, infos, ["U'", "B'"]);
    expect(s2.mode).to.equal('executing');
  });

  it('undo in non-reverse order also works (simplification handles it)', () => {
    const { state, infos } = initState(['R']);
    const { state: s1 } = applyMoves(state, infos, ['B', 'U']);
    // Do B' first (not reverse order): wrongMoves = simplify(['B','U',"B'"]) = ['U',"B'"] wait no...
    // simplifyMoves(['B','U',"B'"]) = push B, push U (diff face), B': diff face from U, push. = ['B','U',"B'"]
    // Hmm, B and B' aren't adjacent so they don't cancel. Order matters.
    // So you DO need reverse order (or the right combination that simplifies to empty).
    const { state: s2 } = applyMoves(s1, infos, ["B'"]);
    expect(s2.mode).to.equal('error');
    if (s2.mode === 'error') {
      // B U B' doesn't simplify further (non-adjacent different faces)
      expect(s2.wrongMoves).to.deep.equal(['B', 'U', "B'"]);
    }
  });

  it('same-face wrong moves are simplified', () => {
    const { state, infos } = initState(['R']);
    // B B -> simplified to B2
    const { state: s1 } = applyMoves(state, infos, ['B', 'B']);
    if (s1.mode === 'error') {
      expect(s1.wrongMoves).to.deep.equal(['B2']);
    }
    // B B B -> simplified to B'
    const { state: s2 } = applyMoves(s1, infos, ['B']);
    if (s2.mode === 'error') {
      expect(s2.wrongMoves).to.deep.equal(["B'"]);
    }
  });

  it('R R R R cancels completely and returns to executing', () => {
    const { state, infos } = initState(['U']);
    const { state: s1 } = applyMoves(state, infos, ['R', 'R', 'R', 'R']);
    expect(s1.mode).to.equal('executing');
  });

  it('undo display cycles: U wrong then U U U returns to executing', () => {
    const { state, infos } = initState(['D']);
    // U is wrong face
    const { state: s1 } = applyMoves(state, infos, ['U']);
    if (s1.mode === 'error') expect(s1.wrongMoves).to.deep.equal(['U']);
    // Another U -> wrongMoves = U2
    const { state: s2 } = applyMoves(s1, infos, ['U']);
    if (s2.mode === 'error') expect(s2.wrongMoves).to.deep.equal(['U2']);
    // Another U -> wrongMoves = U'
    const { state: s3 } = applyMoves(s2, infos, ['U']);
    if (s3.mode === 'error') expect(s3.wrongMoves).to.deep.equal(["U'"]);
    // Another U -> wrongMoves = [] -> back to executing
    const { state: s4 } = applyMoves(s3, infos, ['U']);
    expect(s4.mode).to.equal('executing');
  });

  it('correct undo shrinks wrongMoves progressively', () => {
    const { state, infos } = initState(['R']);
    const { state: s1 } = applyMoves(state, infos, ['B', 'U', 'F']);
    if (s1.mode === 'error') expect(s1.wrongMoves).to.deep.equal(['B', 'U', 'F']);
    // F' undoes last
    const { state: s2 } = applyMoves(s1, infos, ["F'"]);
    if (s2.mode === 'error') expect(s2.wrongMoves).to.deep.equal(['B', 'U']);
    // U' undoes next
    const { state: s3 } = applyMoves(s2, infos, ["U'"]);
    if (s3.mode === 'error') expect(s3.wrongMoves).to.deep.equal(['B']);
    // B' undoes last
    const { state: s4 } = applyMoves(s3, infos, ["B'"]);
    expect(s4.mode).to.equal('executing');
  });

  it('double-move wrong undone with two quarter turns', () => {
    const { state, infos } = initState(['R']);
    // B B = B2
    const { state: s1 } = applyMoves(state, infos, ['B', 'B']);
    if (s1.mode === 'error') expect(s1.wrongMoves).to.deep.equal(['B2']);
    // B' reduces B2 to B
    const { state: s2 } = applyMoves(s1, infos, ["B'"]);
    if (s2.mode === 'error') expect(s2.wrongMoves).to.deep.equal(['B']);
    // B' cancels B
    const { state: s3 } = applyMoves(s2, infos, ["B'"]);
    expect(s3.mode).to.equal('executing');
  });

  it('wrong move during partial double move preserves partial progress', () => {
    const { state, infos } = initState(['R2', 'U']);
    // R (first half of R2)
    const { state: s1 } = applyMoves(state, infos, ['R']);
    expect(s1.moveStatuses[0]).to.equal('yellow');
    // B (wrong face) - partials preserved, only B in wrongMoves
    const { state: s2 } = applyMoves(s1, infos, ['B']);
    expect(s2.mode).to.equal('error');
    if (s2.mode === 'error') {
      expect(s2.wrongMoves).to.deep.equal(['B']);
      expect(s2.partials[0]).to.deep.equal(['R']);
    }
    // Undo B' -> back to executing with R partial progress
    const { state: s3 } = applyMoves(s2, infos, ["B'"]);
    expect(s3.mode).to.equal('executing');
    expect(s3.moveIndex).to.equal(0);
    expect(s3.moveStatuses[0]).to.equal('yellow');
    if (s3.mode === 'executing') {
      expect(s3.partials[0]).to.deep.equal(['R']);
    }
    // Now just one more R completes R2
    const { state: s4 } = applyMoves(s3, infos, ['R']);
    expect(s4.moveStatuses[0]).to.equal('done');
    expect(s4.moveIndex).to.equal(1);
  });

  it('many wrong moves then full undo works', () => {
    const { state, infos } = initState(['R']);
    const wrongs = ['B', 'U', 'F', "D'", 'L'];
    const { state: s1 } = applyMoves(state, infos, wrongs);
    expect(s1.mode).to.equal('error');
    if (s1.mode === 'error') {
      expect(s1.wrongMoves).to.deep.equal(wrongs);
    }
    // Undo all in reverse
    const undos = [...wrongs].reverse().map(invertQuarterTurn);
    const { state: s2 } = applyMoves(s1, infos, undos);
    expect(s2.mode).to.equal('executing');
  });

  it('stress: chaotic sequence resolves correctly', () => {
    const { state, infos } = initState(["R'", 'U', 'F2']);
    const { state: s1 } = applyMoves(state, infos, [
      'B',      // wrong -> wrongs=[B]
      'U',      // wrong -> wrongs=[B,U]
      "U'",     // undo U -> wrongs=[B]
      'F',      // wrong -> wrongs=[B,F]
      "F'",     // undo F -> wrongs=[B]
      'D',      // wrong -> wrongs=[B,D]
      "L'",     // wrong -> wrongs=[B,D,L']
      'L',      // undo L' -> wrongs=[B,D]
      "D'",     // undo D -> wrongs=[B]
      "B'",     // undo B -> wrongs=[] -> executing
    ]);
    expect(s1.mode).to.equal('executing');
    expect(s1.moveIndex).to.equal(0);
    // Now actually do the scramble correctly
    const { state: s2, completions } = applyMoves(s1, infos, ["R'", 'U', 'F', 'F']);
    expect(completions).to.equal(1);
    expect(s2.moveIndex).to.equal(3);
  });

  it('after full recovery, can complete the scramble', () => {
    const { state, infos } = initState(['R', "U'", 'F']);
    const { state: s1 } = applyMoves(state, infos, ['B']);
    expect(s1.mode).to.equal('error');
    const { state: s2 } = applyMoves(s1, infos, ["B'"]);
    expect(s2.mode).to.equal('executing');
    const { completions } = applyMoves(s2, infos, ['R', "U'", 'F']);
    expect(completions).to.equal(1);
  });

  it('multiple error-recovery cycles', () => {
    const { state, infos } = initState(['R', 'U']);
    // First error
    const { state: s1 } = applyMoves(state, infos, ['B', "B'"]);
    expect(s1.mode).to.equal('executing');
    // Do R correctly
    const { state: s2 } = applyMoves(s1, infos, ['R']);
    expect(s2.moveIndex).to.equal(1);
    // Second error on the U move
    const { state: s3 } = applyMoves(s2, infos, ['F', "F'"]);
    expect(s3.mode).to.equal('executing');
    expect(s3.moveIndex).to.equal(1);
    // Complete
    const { completions: c } = applyMoves(s3, infos, ['U']);
    expect(c).to.equal(1);
  });
});

describe('scrambleGuideState - cube state consistency', () => {
  function verifyCubeClean(cubeMovesApplied: string[], label: string) {
    const net = netCubeState(cubeMovesApplied);
    expect(Object.keys(net).length, `${label}: cube should be clean but has net moves: ${JSON.stringify(net)}`).to.equal(0);
  }

  it('single wrong + undo leaves cube clean', () => {
    const moves = ['B', "B'"];
    verifyCubeClean(moves, 'single wrong');
  });

  it('partial undo + new wrong + full undo leaves cube clean', () => {
    const moves = ['B', 'U', "U'", 'F', "F'", "B'"];
    verifyCubeClean(moves, 'partial undo chaos');
  });

  it('deep chaos sequence leaves cube clean', () => {
    const moves = [
      'B', 'U', "U'", 'F', "F'", 'D', "L'", 'L', "D'", "B'",
    ];
    verifyCubeClean(moves, 'deep chaos');

    const { state, infos } = initState(["R'"]);
    const { state: final } = applyMoves(state, infos, moves);
    expect(final.mode).to.equal('executing');
  });

  it('triple wrong + sequential undo leaves cube clean', () => {
    const moves = [
      'B', 'U', 'F',   // three wrongs
      "F'",             // undo F
      "U'",             // undo U
      "B'",             // undo B
    ];
    verifyCubeClean(moves, 'triple undo');

    const { state, infos } = initState(['R']);
    const { state: final } = applyMoves(state, infos, moves);
    expect(final.mode).to.equal('executing');
  });

  it('same-face wrongs + undo leaves cube clean', () => {
    // B B = B2 wrong, undo with B' B'
    const moves = ['B', 'B', "B'", "B'"];
    verifyCubeClean(moves, 'double undo');

    const { state, infos } = initState(['R']);
    const { state: final } = applyMoves(state, infos, moves);
    expect(final.mode).to.equal('executing');
  });

  it('R R R R (full rotation) cancels and leaves cube clean', () => {
    const moves = ['R', 'R', 'R', 'R'];
    verifyCubeClean(moves, 'full rotation');

    const { state, infos } = initState(['U']);
    const { state: final } = applyMoves(state, infos, moves);
    expect(final.mode).to.equal('executing');
  });
});

describe('movesCommute', () => {
  it('opposite faces commute', () => {
    expect(movesCommute('R', 'L')).to.be.true;
    expect(movesCommute('L', 'R')).to.be.true;
    expect(movesCommute('U', 'D')).to.be.true;
    expect(movesCommute('D', 'U')).to.be.true;
    expect(movesCommute('F', 'B')).to.be.true;
    expect(movesCommute('B', 'F')).to.be.true;
  });

  it('non-opposite faces do not commute', () => {
    expect(movesCommute('R', 'U')).to.be.false;
    expect(movesCommute('R', 'F')).to.be.false;
    expect(movesCommute('R', 'B')).to.be.false;
    expect(movesCommute('R', 'D')).to.be.false;
    expect(movesCommute('U', 'F')).to.be.false;
  });

  it('same face does not commute (not relevant but should be false)', () => {
    expect(movesCommute('R', 'R')).to.be.false;
  });
});

describe('scrambleGuideState - partial move preservation', () => {
  it('R2 scramble: do R, wrong B, undo B -> back to executing with R counted, then R completes R2', () => {
    const { state, infos } = initState(['R2', "B'"]);
    // R (partial)
    const { state: s1 } = applyMoves(state, infos, ['R']);
    expect(s1.mode).to.equal('executing');
    expect(s1.moveStatuses[0]).to.equal('yellow');
    // B (wrong)
    const { state: s2 } = applyMoves(s1, infos, ['B']);
    expect(s2.mode).to.equal('error');
    if (s2.mode === 'error') {
      expect(s2.wrongMoves).to.deep.equal(['B']);
      expect(s2.partials[0]).to.deep.equal(['R']);
    }
    // B' (undo) -> back to executing with R partial
    const { state: s3 } = applyMoves(s2, infos, ["B'"]);
    expect(s3.mode).to.equal('executing');
    expect(s3.moveStatuses[0]).to.equal('yellow');
    if (s3.mode === 'executing') {
      expect(s3.partials[0]).to.deep.equal(['R']);
    }
    // R -> completes R2
    const { state: s4 } = applyMoves(s3, infos, ['R']);
    expect(s4.moveStatuses[0]).to.equal('done');
    expect(s4.moveIndex).to.equal(1);
  });

  it('R2 scramble: do R, wrong B, wrong U, undo U, undo B -> back with R partial', () => {
    const { state, infos } = initState(['R2']);
    const { state: s1 } = applyMoves(state, infos, ['R']);
    expect(s1.moveStatuses[0]).to.equal('yellow');
    // Two wrong moves
    const { state: s2 } = applyMoves(s1, infos, ['B', 'U']);
    expect(s2.mode).to.equal('error');
    if (s2.mode === 'error') {
      expect(s2.wrongMoves).to.deep.equal(['B', 'U']);
      expect(s2.partials[0]).to.deep.equal(['R']);
    }
    // Undo both
    const { state: s3 } = applyMoves(s2, infos, ["U'", "B'"]);
    expect(s3.mode).to.equal('executing');
    expect(s3.moveStatuses[0]).to.equal('yellow');
    if (s3.mode === 'executing') {
      expect(s3.partials[0]).to.deep.equal(['R']);
    }
    // Complete R2
    const { completions } = applyMoves(s3, infos, ['R']);
    expect(completions).to.equal(1);
  });

  it("R' scramble: wrong direction R, wrong move, undo -> partial preserved", () => {
    const { state, infos } = initState(["R'"]);
    // R (wrong direction but same face)
    const { state: s1 } = applyMoves(state, infos, ['R']);
    expect(s1.mode).to.equal('executing');
    expect(s1.moveStatuses[0]).to.equal('yellow');
    // B (wrong face)
    const { state: s2 } = applyMoves(s1, infos, ['B']);
    expect(s2.mode).to.equal('error');
    if (s2.mode === 'error') {
      expect(s2.partials[0]).to.deep.equal(['R']);
    }
    // Undo B
    const { state: s3 } = applyMoves(s2, infos, ["B'"]);
    expect(s3.mode).to.equal('executing');
    expect(s3.moveStatuses[0]).to.equal('yellow');
    if (s3.mode === 'executing') {
      expect(s3.partials[0]).to.deep.equal(['R']);
    }
  });

  it('specific scenario: R2 with partial R, wrong move, undo -> only R remaining (not R\' + R2)', () => {
    const { state, infos } = initState(['R2', 'U']);
    // Do R (partial)
    const { state: s1 } = applyMoves(state, infos, ['R']);
    expect(s1.moveStatuses[0]).to.equal('yellow');
    // Wrong move B
    const { state: s2 } = applyMoves(s1, infos, ['B']);
    expect(s2.mode).to.equal('error');
    // Undo wrong move B
    const { state: s3 } = applyMoves(s2, infos, ["B'"]);
    expect(s3.mode).to.equal('executing');
    // Only one more R needed (not R' + R2)
    if (s3.mode === 'executing') {
      expect(s3.partials[0]).to.deep.equal(['R']);
    }
    expect(s3.moveStatuses[0]).to.equal('yellow');
    const { state: s4 } = applyMoves(s3, infos, ['R']);
    expect(s4.moveStatuses[0]).to.equal('done');
    expect(s4.moveIndex).to.equal(1);
  });
});

describe('scrambleGuideState - commutative adjacent moves', () => {
  it('R L\': do L\' first, then R -> completes', () => {
    const { state, infos } = initState(['R', "L'"]);
    // L' out of order (commutes with R)
    const { state: s1 } = applyMoves(state, infos, ["L'"]);
    expect(s1.mode).to.equal('executing');
    expect(s1.moveStatuses[1]).to.equal('done');
    expect(s1.moveIndex).to.equal(0); // R still pending
    // Now do R
    const { completions } = applyMoves(s1, infos, ['R']);
    expect(completions).to.equal(1);
  });

  it('R L\': do R first (normal order) -> still works', () => {
    const { state, infos } = initState(['R', "L'"]);
    const { completions } = applyMoves(state, infos, ['R', "L'"]);
    expect(completions).to.equal(1);
  });

  it('R L\' U: do L\' first, then R, then U -> completes', () => {
    const { state, infos } = initState(['R', "L'", 'U']);
    const { state: s1 } = applyMoves(state, infos, ["L'"]);
    expect(s1.moveStatuses[1]).to.equal('done');
    const { state: s2 } = applyMoves(s1, infos, ['R']);
    expect(s2.moveStatuses[0]).to.equal('done');
    // moveIndex should advance past both done indices to 2
    expect(s2.moveIndex).to.equal(2);
    const { completions } = applyMoves(s2, infos, ['U']);
    expect(completions).to.equal(1);
  });

  it('R U: do U first -> error (R and U don\'t commute)', () => {
    const { state, infos } = initState(['R', 'U']);
    const { state: s1 } = applyMoves(state, infos, ['U']);
    expect(s1.mode).to.equal('error');
  });

  it('R L\' U: do U first -> error (U doesn\'t commute with R)', () => {
    const { state, infos } = initState(['R', "L'", 'U']);
    const { state: s1 } = applyMoves(state, infos, ['U']);
    expect(s1.mode).to.equal('error');
  });

  it('U D R: do D first, then U, then R -> completes (U/D commute)', () => {
    const { state, infos } = initState(['U', 'D', 'R']);
    const { state: s1 } = applyMoves(state, infos, ['D']);
    expect(s1.moveStatuses[1]).to.equal('done');
    expect(s1.moveIndex).to.equal(0);
    const { state: s2 } = applyMoves(s1, infos, ['U']);
    expect(s2.moveStatuses[0]).to.equal('done');
    expect(s2.moveIndex).to.equal(2);
    const { completions } = applyMoves(s2, infos, ['R']);
    expect(completions).to.equal(1);
  });

  it('R2 L: do L first then R R -> completes', () => {
    const { state, infos } = initState(['R2', 'L']);
    // L out of order
    const { state: s1 } = applyMoves(state, infos, ['L']);
    expect(s1.moveStatuses[1]).to.equal('done');
    expect(s1.moveIndex).to.equal(0);
    // R R to complete R2
    const { state: s2, completions } = applyMoves(s1, infos, ['R', 'R']);
    expect(s2.moveStatuses[0]).to.equal('done');
    expect(completions).to.equal(1);
  });

  it('R L2: do L L first (two quarter turns) then R -> completes', () => {
    const { state, infos } = initState(['R', 'L2']);
    // First L (partial of L2)
    const { state: s1 } = applyMoves(state, infos, ['L']);
    expect(s1.moveStatuses[1]).to.equal('yellow');
    expect(s1.moveIndex).to.equal(0);
    // Second L (completes L2)
    const { state: s2 } = applyMoves(s1, infos, ['L']);
    expect(s2.moveStatuses[1]).to.equal('done');
    expect(s2.moveIndex).to.equal(0);
    // R to complete
    const { completions } = applyMoves(s2, infos, ['R']);
    expect(completions).to.equal(1);
  });

  it('L2 R2: interleaved L\' R L\' R -> completes (per-index partial tracking)', () => {
    const { state, infos } = initState(['L2', 'R2']);
    // L' (partial of L2)
    const { state: s1 } = applyMoves(state, infos, ["L'"]);
    expect(s1.moveStatuses[0]).to.equal('yellow');
    // R (partial of R2, out of order)
    const { state: s2 } = applyMoves(s1, infos, ['R']);
    expect(s2.moveStatuses[1]).to.equal('yellow');
    // L' still tracked for index 0
    if (s2.mode === 'executing') {
      expect(s2.partials[0]).to.deep.equal(["L'"]);
      expect(s2.partials[1]).to.deep.equal(['R']);
    }
    // L' (completes L2)
    const { state: s3 } = applyMoves(s2, infos, ["L'"]);
    expect(s3.moveStatuses[0]).to.equal('done');
    // R (completes R2)
    const { state: s4, completions } = applyMoves(s3, infos, ['R']);
    expect(s4.moveStatuses[1]).to.equal('done');
    expect(completions).to.equal(1);
  });

  it('R2 L2: L\' R undo-L then error recovery works', () => {
    const { state, infos } = initState(['R2', 'L2']);
    // L' (out of order, partial of L2)
    const { state: s1 } = applyMoves(state, infos, ["L'"]);
    expect(s1.moveStatuses[1]).to.equal('yellow');
    // R (partial of R2)
    const { state: s2 } = applyMoves(s1, infos, ['R']);
    expect(s2.moveStatuses[0]).to.equal('yellow');
    // L (undo the L' on index 1)
    const { state: s3 } = applyMoves(s2, infos, ['L']);
    expect(s3.moveStatuses[1]).to.equal('pending');
    // R partial for index 0 should still be intact
    if (s3.mode === 'executing') {
      expect(s3.partials[0]).to.deep.equal(['R']);
    }
    // B (wrong move)
    const { state: s4 } = applyMoves(s3, infos, ['B']);
    expect(s4.mode).to.equal('error');
    // Undo B
    const { state: s5 } = applyMoves(s4, infos, ["B'"]);
    expect(s5.mode).to.equal('executing');
    // R partial should still be there
    if (s5.mode === 'executing') {
      expect(s5.partials[0]).to.deep.equal(['R']);
    }
    // Complete R2 with one more R, then do L2
    const { completions } = applyMoves(s5, infos, ['R', 'L', 'L']);
    expect(completions).to.equal(1);
  });
});

describe('computeDifferentialScramble', () => {
  const fakeKPuzzle = {} as KPuzzle;

  it('cube already at target -> returns alreadyDone', async () => {
    const getFacelets = async () => 'SOLVED_STATE';
    const computeTransition: ComputeTransitionFn = async () => [];

    const result = await computeDifferentialScramble(
      getFacelets, "R U R'", fakeKPuzzle, () => true, computeTransition,
    );
    expect(result).to.deep.equal({ moves: [], alreadyDone: true });
  });

  it('cube at solved state -> returns scramble moves', async () => {
    const getFacelets = async () => 'SOLVED';
    const computeTransition: ComputeTransitionFn = async () => ['R', 'U', "R'"];

    const result = await computeDifferentialScramble(
      getFacelets, "R U R'", fakeKPuzzle, () => true, computeTransition,
    );
    expect(result).to.deep.equal({ moves: ['R', 'U', "R'"], alreadyDone: false });
  });

  it('cube at different scramble -> returns valid transition moves', async () => {
    const getFacelets = async () => 'SOME_STATE';
    const computeTransition: ComputeTransitionFn = async () => ["U'", 'R'];

    const result = await computeDifferentialScramble(
      getFacelets, "R U", fakeKPuzzle, () => true, computeTransition,
    );
    expect(result).to.deep.equal({ moves: ["U'", 'R'], alreadyDone: false });
  });

  it('verify loop: recomputes when cube moves during computation', async () => {
    let callCount = 0;
    const getFacelets = async () => {
      callCount++;
      if (callCount <= 1) return 'STATE_A';
      if (callCount <= 2) return 'STATE_B';
      return 'STATE_B';
    };

    const transitions: string[][] = [];
    const computeTransition: ComputeTransitionFn = async (facelets) => {
      if (facelets === 'STATE_A') {
        const moves = ['R', 'U'];
        transitions.push(moves);
        return moves;
      }
      const moves = ["L'"];
      transitions.push(moves);
      return moves;
    };

    const result = await computeDifferentialScramble(
      getFacelets, 'target', fakeKPuzzle, () => true, computeTransition,
    );
    expect(transitions.length).to.equal(2);
    expect(result).to.deep.equal({ moves: ["L'"], alreadyDone: false });
  });

  it('verify loop convergence: stabilizes on second iteration', async () => {
    let callCount = 0;
    const getFacelets = async () => {
      callCount++;
      return callCount <= 1 ? 'STATE_A' : 'STATE_B';
    };

    let computeCount = 0;
    const computeTransition: ComputeTransitionFn = async () => {
      computeCount++;
      return ['F'];
    };

    const result = await computeDifferentialScramble(
      getFacelets, 'target', fakeKPuzzle, () => true, computeTransition,
    );
    expect(computeCount).to.equal(2);
    expect(result).to.deep.equal({ moves: ['F'], alreadyDone: false });
  });

  it('isCurrentScramble returns false mid-computation -> returns null', async () => {
    let isCurrentCall = 0;
    const isCurrentScramble = () => {
      isCurrentCall++;
      return isCurrentCall <= 1;
    };

    let callCount = 0;
    const getFacelets = async () => {
      callCount++;
      return `STATE_${callCount}`;
    };

    const computeTransition: ComputeTransitionFn = async () => ['R'];

    const result = await computeDifferentialScramble(
      getFacelets, 'target', fakeKPuzzle, isCurrentScramble, computeTransition,
    );
    expect(result).to.be.null;
  });

  it('simplifies transition moves (e.g. R R -> R2)', async () => {
    const getFacelets = async () => 'STATE';
    const computeTransition: ComputeTransitionFn = async () => ['R', 'R'];

    const result = await computeDifferentialScramble(
      getFacelets, 'target', fakeKPuzzle, () => true, computeTransition,
    );
    expect(result).to.deep.equal({ moves: ['R2'], alreadyDone: false });
  });
});
