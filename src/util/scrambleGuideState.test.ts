import { expect } from 'chai';
import {
  parseMoveInfo, invertQuarterTurn, netProgress, transition,
  GuideState, MoveInfo,
} from './scrambleGuideState';

// Helper: create initial state for a given move list
function initState(moves: string[]): { state: GuideState; infos: MoveInfo[] } {
  const infos = moves.map(parseMoveInfo);
  const state: GuideState = {
    mode: 'executing',
    moveIndex: 0,
    moveStatuses: moves.map(() => 'pending' as const),
    partialMoves: [],
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
// After all undos, the net should be equivalent to the target scramble moves.
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
      expect(r.state.undoIndex).to.equal(0);
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

  it('partial undo then new wrong move: truncates already-undone', () => {
    const { state, infos } = initState(['R']);
    // Do B, U (wrong)
    const { state: s1 } = applyMoves(state, infos, ['B', 'U']);
    expect(s1.mode).to.equal('error');
    // Undo U' (partial)
    const { state: s2 } = applyMoves(s1, infos, ["U'"]);
    expect(s2.mode).to.equal('error');
    if (s2.mode === 'error') {
      expect(s2.undoIndex).to.equal(1);
    }
    // Now do F (new wrong move instead of continuing undo)
    const { state: s3 } = applyMoves(s2, infos, ['F']);
    expect(s3.mode).to.equal('error');
    if (s3.mode === 'error') {
      // Should be [B, F] not [B, U, F] since U was already undone
      expect(s3.wrongMoves).to.deep.equal(['B', 'F']);
      expect(s3.undoIndex).to.equal(0);
    }
    // Now undo F' then B' to get back to executing
    const { state: s4 } = applyMoves(s3, infos, ["F'", "B'"]);
    expect(s4.mode).to.equal('executing');
  });

  it('partial undo then cancel last effective wrong', () => {
    const { state, infos } = initState(['R']);
    // Do B, U, F (three wrong)
    const { state: s1 } = applyMoves(state, infos, ['B', 'U', 'F']);
    // Undo F' (partial, undoIndex=1)
    const { state: s2 } = applyMoves(s1, infos, ["F'"]);
    if (s2.mode === 'error') {
      expect(s2.undoIndex).to.equal(1);
    }
    // Now do U' - this is NOT the expected undo (B'), but it IS inverse of last effective wrong (U)
    // After truncation: effective = [B, U], lastWrong = U, U' = invertQuarterTurn(U)
    // But wait: expected undo is also invertQuarterTurn(wrongMoves[length-1-undoIndex])
    //   = invertQuarterTurn(wrongMoves[3-1-1]) = invertQuarterTurn(wrongMoves[1]) = invertQuarterTurn(U) = U'
    // So U' IS the expected undo! It should increment undoIndex.
    const { state: s3 } = applyMoves(s2, infos, ["U'"]);
    if (s3.mode === 'error') {
      expect(s3.undoIndex).to.equal(2);
    }
    // Now B' to finish
    const { state: s4 } = applyMoves(s3, infos, ["B'"]);
    expect(s4.mode).to.equal('executing');
  });

  it('wrong move during partial double move includes partial in wrongMoves', () => {
    const { state, infos } = initState(['R2', 'U']);
    // R (first half of R2)
    const { state: s1 } = applyMoves(state, infos, ['R']);
    expect(s1.moveStatuses[0]).to.equal('yellow');
    // B (wrong face)
    const { state: s2 } = applyMoves(s1, infos, ['B']);
    expect(s2.mode).to.equal('error');
    if (s2.mode === 'error') {
      expect(s2.wrongMoves).to.deep.equal(['R', 'B']);
    }
    // Undo: B' then R'
    const { state: s3 } = applyMoves(s2, infos, ["B'", "R'"]);
    expect(s3.mode).to.equal('executing');
    expect(s3.moveIndex).to.equal(0);
    expect(s3.moveStatuses[0]).to.equal('pending');
    // Now redo R2 properly
    const { state: s4 } = applyMoves(s3, infos, ['R', 'R']);
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

  it('repeated same wrong move then undo all', () => {
    const { state, infos } = initState(['R']);
    const { state: s1 } = applyMoves(state, infos, ['B', 'B', 'B']);
    if (s1.mode === 'error') {
      expect(s1.wrongMoves).to.deep.equal(['B', 'B', 'B']);
    }
    const { state: s2 } = applyMoves(s1, infos, ["B'", "B'", "B'"]);
    expect(s2.mode).to.equal('executing');
  });

  it('interleaved partial undo and new wrongs', () => {
    const { state, infos } = initState(['R']);
    // B, U wrong
    const { state: s1 } = applyMoves(state, infos, ['B', 'U']);
    // Undo U'
    const { state: s2 } = applyMoves(s1, infos, ["U'"]);
    if (s2.mode === 'error') expect(s2.undoIndex).to.equal(1);
    // New wrong F
    const { state: s3 } = applyMoves(s2, infos, ['F']);
    if (s3.mode === 'error') {
      expect(s3.wrongMoves).to.deep.equal(['B', 'F']);
      expect(s3.undoIndex).to.equal(0);
    }
    // Undo F'
    const { state: s4 } = applyMoves(s3, infos, ["F'"]);
    if (s4.mode === 'error') expect(s4.undoIndex).to.equal(1);
    // New wrong D
    const { state: s5 } = applyMoves(s4, infos, ['D']);
    if (s5.mode === 'error') {
      expect(s5.wrongMoves).to.deep.equal(['B', 'D']);
      expect(s5.undoIndex).to.equal(0);
    }
    // Fully undo: D' then B'
    const { state: s6 } = applyMoves(s5, infos, ["D'", "B'"]);
    expect(s6.mode).to.equal('executing');
  });

  it('stress: random-like chaos sequence resolves correctly', () => {
    const { state, infos } = initState(["R'", 'U', 'F2']);
    // A chaotic sequence: wrong moves, partial undos, more wrongs
    const { state: s1 } = applyMoves(state, infos, [
      'B',      // wrong -> error, wrongs=[B]
      'U',      // wrong -> wrongs=[B,U]
      "U'",     // undo U -> undoIndex=1
      'F',      // new wrong (truncate) -> wrongs=[B,F]
      "F'",     // undo F -> undoIndex=1
      'D',      // new wrong (truncate) -> wrongs=[B,D]
      "L'",     // wrong -> wrongs=[B,D,L']
      'L',      // undo L' -> undoIndex=1
      "D'",     // undo D -> undoIndex=2
      "B'",     // undo B -> all done, executing
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
    // Wrong move, undo, then complete
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
  // These tests verify that after the state machine returns to 'executing',
  // the net physical cube moves are zero (all wrongs fully undone).

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

    // Also verify the state machine agrees
    const { state, infos } = initState(["R'"]);
    const { state: final } = applyMoves(state, infos, moves);
    expect(final.mode).to.equal('executing');
  });

  it('triple partial undo + wrongs leaves cube clean after full recovery', () => {
    const moves = [
      'B', 'U', 'F',   // three wrongs
      "F'",             // undo F (undoIndex=1)
      'D',              // new wrong -> wrongs=[B,U,D]
      "D'",             // undo D (undoIndex=1)
      "U'",             // undo U (undoIndex=2)
      "B'",             // undo B (undoIndex=3, all done)
    ];
    verifyCubeClean(moves, 'triple partial');

    const { state, infos } = initState(['R']);
    const { state: final } = applyMoves(state, infos, moves);
    expect(final.mode).to.equal('executing');
  });
});
