// Pure state machine for ScrambleGuide, extracted for testability.

export interface MoveInfo {
  face: string;
  isDouble: boolean;
  expected: string | null;
}

export function parseMoveInfo(move: string): MoveInfo {
  const match = move.match(/^([A-Za-z])(\d*)('?)$/);
  if (!match) return { face: move, isDouble: false, expected: move };
  const [, face, countStr, prime] = match;
  if (countStr === '2') {
    return { face, isDouble: true, expected: null };
  }
  const expected = prime ? `${face}'` : face;
  return { face, isDouble: false, expected };
}

export function invertQuarterTurn(move: string): string {
  const match = move.match(/^([A-Za-z])('?)$/);
  if (!match) return move;
  const [, face, prime] = match;
  return prime ? face : `${face}'`;
}

export function netProgress(partialMoves: string[], face: string): number {
  let net = 0;
  for (const m of partialMoves) {
    if (m === face) net++;
    else if (m === `${face}'`) net--;
  }
  return net;
}

export type MoveStatus = 'pending' | 'done' | 'yellow';

export type GuideState =
  | {
      mode: 'executing';
      moveIndex: number;
      moveStatuses: MoveStatus[];
      partialMoves: string[];
    }
  | {
      mode: 'error';
      moveIndex: number;
      moveStatuses: MoveStatus[];
      partialMoves: string[];
      wrongMoves: string[];
      undoIndex: number;
    };

export type TransitionResult = { state: GuideState; completed: boolean };

export function transition(
  prev: GuideState,
  actual: string,
  moveInfos: MoveInfo[],
): TransitionResult {
  const actualFace = actual.charAt(0);

  if (prev.mode === 'executing') {
    if (prev.moveIndex >= moveInfos.length) return { state: prev, completed: false };

    const info = moveInfos[prev.moveIndex];

    if (actualFace === info.face) {
      if (info.isDouble) {
        const newPartial = [...prev.partialMoves, actual];
        const net = netProgress(newPartial, info.face);

        if (Math.abs(net) >= 2) {
          const newStatuses = [...prev.moveStatuses];
          newStatuses[prev.moveIndex] = 'done';
          const nextIndex = prev.moveIndex + 1;
          const completed = nextIndex >= moveInfos.length;
          return {
            state: { ...prev, moveIndex: nextIndex, moveStatuses: newStatuses, partialMoves: [] },
            completed,
          };
        }

        const newStatuses = [...prev.moveStatuses];
        newStatuses[prev.moveIndex] = net === 0 ? 'pending' : 'yellow';
        return { state: { ...prev, moveStatuses: newStatuses, partialMoves: newPartial }, completed: false };
      } else {
        const newPartial = [...prev.partialMoves, actual];
        const net = netProgress(newPartial, info.face);
        const targetDir = info.expected === info.face ? 1 : -1;

        if (net === targetDir) {
          const newStatuses = [...prev.moveStatuses];
          newStatuses[prev.moveIndex] = 'done';
          const nextIndex = prev.moveIndex + 1;
          const completed = nextIndex >= moveInfos.length;
          return {
            state: { mode: 'executing', moveIndex: nextIndex, moveStatuses: newStatuses, partialMoves: [] },
            completed,
          };
        }

        const newStatuses = [...prev.moveStatuses];
        newStatuses[prev.moveIndex] = net === 0 ? 'pending' : 'yellow';
        return { state: { ...prev, moveStatuses: newStatuses, partialMoves: newPartial }, completed: false };
      }
    }

    // Wrong face
    const wrongMoves = [...prev.partialMoves, actual];
    return {
      state: {
        mode: 'error',
        moveIndex: prev.moveIndex,
        moveStatuses: prev.moveStatuses,
        partialMoves: [],
        wrongMoves,
        undoIndex: 0,
      },
      completed: false,
    };
  }

  // Error state
  const undoMoves = [...prev.wrongMoves].reverse().map(invertQuarterTurn);
  const expectedUndo = undoMoves[prev.undoIndex];

  if (actual === expectedUndo) {
    const nextUndoIndex = prev.undoIndex + 1;
    if (nextUndoIndex >= undoMoves.length) {
      const newStatuses = [...prev.moveStatuses];
      newStatuses[prev.moveIndex] = 'pending';
      return {
        state: {
          mode: 'executing',
          moveIndex: prev.moveIndex,
          moveStatuses: newStatuses,
          partialMoves: [],
        },
        completed: false,
      };
    }
    return { state: { ...prev, undoIndex: nextUndoIndex }, completed: false };
  }

  const effectiveWrongs = prev.wrongMoves.slice(0, prev.wrongMoves.length - prev.undoIndex);

  const lastWrong = effectiveWrongs[effectiveWrongs.length - 1];
  if (lastWrong && actual === invertQuarterTurn(lastWrong)) {
    const trimmed = effectiveWrongs.slice(0, -1);
    if (trimmed.length === 0) {
      const newStatuses = [...prev.moveStatuses];
      newStatuses[prev.moveIndex] = 'pending';
      return {
        state: {
          mode: 'executing',
          moveIndex: prev.moveIndex,
          moveStatuses: newStatuses,
          partialMoves: [],
        },
        completed: false,
      };
    }
    return { state: { ...prev, wrongMoves: trimmed, undoIndex: 0 }, completed: false };
  }

  return { state: { ...prev, wrongMoves: [...effectiveWrongs, actual], undoIndex: 0 }, completed: false };
}
