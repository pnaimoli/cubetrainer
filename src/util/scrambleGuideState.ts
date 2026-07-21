// Pure state machine for ScrambleGuide, extracted for testability.

import { simplifyMoves } from './cubeState';
import type { KPuzzle } from 'cubing/kpuzzle';

/**
 * Compute the differential scramble moves with a verify-after-compute loop.
 * Extracted from DifferentialScramble for testability.
 *
 * getFacelets: injectable BLE abstraction (tests can mock it)
 * isCurrentScramble: returns false if the scramble changed during computation (abort)
 */
export type ComputeTransitionFn = (facelets: string, scramble: string, kpuzzle: KPuzzle) => Promise<string[]>;

export async function computeDifferentialScramble(
  getFacelets: () => Promise<string>,
  scramble: string,
  kpuzzle: KPuzzle,
  isCurrentScramble: () => boolean,
  computeTransition?: ComputeTransitionFn,
): Promise<{ moves: string[]; alreadyDone: boolean } | null> {
  const computeTransitionMoves = computeTransition
    ?? (await import('./cubeState')).computeTransitionMoves;

  let facelets = await getFacelets();
  while (isCurrentScramble()) {
    const rawMoves = await computeTransitionMoves(facelets, scramble, kpuzzle);
    const simplified = simplifyMoves(rawMoves);

    // Re-read facelets to check for moves made during computation
    const verifyFacelets = await getFacelets();
    if (verifyFacelets === facelets) {
      // Cube didn't move during computation - result is valid
      if (simplified.length === 0) {
        return { moves: [], alreadyDone: true };
      }
      return { moves: simplified, alreadyDone: false };
    }
    // Cube moved during computation - recompute from new state
    facelets = verifyFacelets;
  }
  // Scramble changed mid-computation
  return null;
}

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
  if (!match) return move; // R2 returns as-is (R2 is its own inverse)
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

export function movesCommute(face1: string, face2: string): boolean {
  const FACE_INDEX: Record<string, number> = { R: 0, L: 1, U: 2, D: 3, F: 4, B: 5 };
  const i = FACE_INDEX[face1], j = FACE_INDEX[face2];
  if (i === undefined || j === undefined) return false;
  return (i ^ 1) === j; // opposite faces commute
}

export type MoveStatus = 'pending' | 'done' | 'yellow';

// Per-index partial move tracking. Keys are move indices, values are quarter-turn arrays.
export type PartialsByIndex = Record<number, string[]>;

export type GuideState =
  | {
      mode: 'executing';
      moveIndex: number;
      moveStatuses: MoveStatus[];
      partials: PartialsByIndex;
    }
  | {
      mode: 'error';
      moveIndex: number;
      moveStatuses: MoveStatus[];
      partials: PartialsByIndex;
      wrongMoves: string[];  // simplified (may contain R2)
    };

export type TransitionResult = { state: GuideState; completed: boolean };

// Skip moveIndex past any consecutive 'done' statuses
function advancePastDone(moveIndex: number, moveStatuses: MoveStatus[]): number {
  let idx = moveIndex;
  while (idx < moveStatuses.length && moveStatuses[idx] === 'done') idx++;
  return idx;
}

function getPartials(partials: PartialsByIndex, index: number): string[] {
  return partials[index] ?? [];
}

function setPartials(partials: PartialsByIndex, index: number, moves: string[]): PartialsByIndex {
  if (moves.length === 0) {
    const { [index]: _, ...rest } = partials;
    return rest;
  }
  return { ...partials, [index]: moves };
}

// Try to apply a quarter-turn move to a specific target move index.
function tryApplyToIndex(
  actual: string,
  targetIndex: number,
  partialMoves: string[],
  moveStatuses: MoveStatus[],
  moveInfos: MoveInfo[],
): { newStatuses: MoveStatus[]; newPartial: string[]; completed: boolean } | null {
  const actualFace = actual.charAt(0);
  const info = moveInfos[targetIndex];
  if (actualFace !== info.face) return null;

  if (info.isDouble) {
    const newPartial = [...partialMoves, actual];
    const net = netProgress(newPartial, info.face);

    if (Math.abs(net) >= 2) {
      const newStatuses = [...moveStatuses];
      newStatuses[targetIndex] = 'done';
      return { newStatuses, newPartial: [], completed: true };
    }

    const newStatuses = [...moveStatuses];
    newStatuses[targetIndex] = net === 0 ? 'pending' : 'yellow';
    return { newStatuses, newPartial, completed: false };
  } else {
    const newPartial = [...partialMoves, actual];
    const net = netProgress(newPartial, info.face);
    const targetDir = info.expected === info.face ? 1 : -1;
    const netMod = ((net % 4) + 4) % 4;
    const targetMod = ((targetDir % 4) + 4) % 4;

    if (netMod === targetMod) {
      const newStatuses = [...moveStatuses];
      newStatuses[targetIndex] = 'done';
      return { newStatuses, newPartial: [], completed: true };
    }

    const newStatuses = [...moveStatuses];
    newStatuses[targetIndex] = netMod === 0 ? 'pending' : 'yellow';
    return { newStatuses, newPartial, completed: false };
  }
}

// Find which index to apply a move to. Returns the target index or -1.
function findTargetIndex(
  actualFace: string,
  currentIndex: number,
  moveInfos: MoveInfo[],
  moveStatuses: MoveStatus[],
): number {
  const info = moveInfos[currentIndex];

  // Direct match on current move
  if (actualFace === info.face) return currentIndex;

  // Check commutative adjacent move
  const nextPending = advancePastDone(currentIndex + 1, moveStatuses);
  if (
    nextPending < moveInfos.length &&
    moveInfos[nextPending].face === actualFace &&
    movesCommute(info.face, actualFace)
  ) {
    return nextPending;
  }

  return -1;
}

export function transition(
  prev: GuideState,
  actual: string,
  moveInfos: MoveInfo[],
): TransitionResult {
  const actualFace = actual.charAt(0);

  if (prev.mode === 'executing') {
    const currentIndex = advancePastDone(prev.moveIndex, prev.moveStatuses);
    if (currentIndex >= moveInfos.length) {
      return { state: prev, completed: false };
    }

    const targetIndex = findTargetIndex(actualFace, currentIndex, moveInfos, prev.moveStatuses);

    if (targetIndex >= 0) {
      const indexPartials = getPartials(prev.partials, targetIndex);
      const result = tryApplyToIndex(actual, targetIndex, indexPartials, prev.moveStatuses, moveInfos)!;
      const newPartials = setPartials(prev.partials, targetIndex, result.newPartial);

      if (result.completed) {
        if (targetIndex === currentIndex) {
          const nextIndex = advancePastDone(currentIndex + 1, result.newStatuses);
          const completed = nextIndex >= moveInfos.length;
          return {
            state: { mode: 'executing', moveIndex: nextIndex, moveStatuses: result.newStatuses, partials: newPartials },
            completed,
          };
        }
        // Out-of-order move completed. Stay at currentIndex.
        return {
          state: { mode: 'executing', moveIndex: currentIndex, moveStatuses: result.newStatuses, partials: newPartials },
          completed: false,
        };
      }
      return {
        state: { mode: 'executing', moveIndex: currentIndex, moveStatuses: result.newStatuses, partials: newPartials },
        completed: false,
      };
    }

    // No match: enter error mode, preserving all partials
    return {
      state: {
        mode: 'error',
        moveIndex: currentIndex,
        moveStatuses: prev.moveStatuses,
        partials: prev.partials,
        wrongMoves: [actual],
      },
      completed: false,
    };
  }

  // Error state: every move appends to wrongMoves and re-simplifies.
  const newWrongMoves = simplifyMoves([...prev.wrongMoves, actual]);

  if (newWrongMoves.length === 0) {
    const newStatuses = [...prev.moveStatuses];
    // Restore moveStatus for the current index based on its partials
    const currentPartials = getPartials(prev.partials, prev.moveIndex);
    if (currentPartials.length > 0) {
      const info = moveInfos[prev.moveIndex];
      const net = netProgress(currentPartials, info.face);
      if (info.isDouble) {
        newStatuses[prev.moveIndex] = net === 0 ? 'pending' : 'yellow';
      } else {
        const netMod = ((net % 4) + 4) % 4;
        newStatuses[prev.moveIndex] = netMod === 0 ? 'pending' : 'yellow';
      }
    } else {
      newStatuses[prev.moveIndex] = 'pending';
    }
    return {
      state: {
        mode: 'executing',
        moveIndex: prev.moveIndex,
        moveStatuses: newStatuses,
        partials: prev.partials,
      },
      completed: false,
    };
  }

  return {
    state: {
      mode: 'error',
      moveIndex: prev.moveIndex,
      moveStatuses: prev.moveStatuses,
      partials: prev.partials,
      wrongMoves: newWrongMoves,
    },
    completed: false,
  };
}
