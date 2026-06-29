import React, { useState, useEffect, useCallback } from 'react';
import { Group, Text } from '@mantine/core';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';

interface ScrambleGuideProps {
  moves: string[];
  conn: GanCubeConnection;
  onComplete: () => void;
}

interface MoveInfo {
  face: string;
  isDouble: boolean;
  // For single moves: the exact expected move (e.g., "R" or "R'")
  expected: string | null;
}

function parseMoveInfo(move: string): MoveInfo {
  const match = move.match(/^([A-Za-z])(\d*)('?)$/);
  if (!match) return { face: move, isDouble: false, expected: move };
  const [, face, countStr, prime] = match;
  if (countStr === '2') {
    return { face, isDouble: true, expected: null };
  }
  const expected = prime ? `${face}'` : face;
  return { face, isDouble: false, expected };
}

function invertQuarterTurn(move: string): string {
  const match = move.match(/^([A-Za-z])('?)$/);
  if (!match) return move;
  const [, face, prime] = match;
  return prime ? face : `${face}'`;
}

/** Compute net quarter turns for a face from a list of moves. +1 for CW, -1 for CCW. */
function netProgress(partialMoves: string[], face: string): number {
  let net = 0;
  for (const m of partialMoves) {
    if (m === face) net++;
    else if (m === `${face}'`) net--;
  }
  return net;
}

type MoveStatus = 'pending' | 'done' | 'yellow';

type GuideState =
  | {
      mode: 'executing';
      moveIndex: number;
      moveStatuses: MoveStatus[];
      partialMoves: string[]; // quarter turns done so far for current move (for doubles)
    }
  | {
      mode: 'error';
      moveIndex: number;
      moveStatuses: MoveStatus[];
      partialMoves: string[]; // preserved partial progress on current move
      wrongMoves: string[];
      undoIndex: number;
    };

const ScrambleGuide: React.FC<ScrambleGuideProps> = ({ moves, conn, onComplete }) => {
  const moveInfos = React.useMemo(() => moves.map(parseMoveInfo), [moves]);

  const [state, setState] = useState<GuideState>({
    mode: 'executing',
    moveIndex: 0,
    moveStatuses: moves.map(() => 'pending'),
    partialMoves: [],
  });

  // Reset when moves change
  useEffect(() => {
    setState({
      mode: 'executing',
      moveIndex: 0,
      moveStatuses: moves.map(() => 'pending'),
      partialMoves: [],
    });
  }, [moves]);

  const handleMove = useCallback((event: GanCubeEvent) => {
    if (event.type !== 'MOVE') return;
    const actual = event.move;
    const actualFace = actual.charAt(0);

    setState(prev => {
      if (prev.mode === 'executing') {
        if (prev.moveIndex >= moveInfos.length) return prev;

        const info = moveInfos[prev.moveIndex];

        if (actualFace === info.face) {
          // Correct face
          if (info.isDouble) {
            // Double move: track net progress
            const newPartial = [...prev.partialMoves, actual];
            const net = netProgress(newPartial, info.face);

            if (Math.abs(net) >= 2) {
              // Double move complete
              const newStatuses = [...prev.moveStatuses];
              newStatuses[prev.moveIndex] = 'done';
              const nextIndex = prev.moveIndex + 1;

              if (nextIndex >= moveInfos.length) {
                setTimeout(onComplete, 0);
                return { ...prev, moveIndex: nextIndex, moveStatuses: newStatuses, partialMoves: [] };
              }
              return { mode: 'executing', moveIndex: nextIndex, moveStatuses: newStatuses, partialMoves: [] };
            }

            // Partial progress
            const newStatuses = [...prev.moveStatuses];
            if (net === 0) {
              // Cancelled out (e.g., R then R')
              newStatuses[prev.moveIndex] = 'pending';
            } else {
              // |net| === 1, in progress
              newStatuses[prev.moveIndex] = 'yellow';
            }
            return { ...prev, moveStatuses: newStatuses, partialMoves: newPartial };
          } else {
            // Single move: track net progress same as double moves.
            // Wrong direction just shows yellow; user undoes naturally.
            const newPartial = [...prev.partialMoves, actual];
            const net = netProgress(newPartial, info.face);
            const targetDir = info.expected === info.face ? 1 : -1;

            if (net === targetDir) {
              // Correct net result
              const newStatuses = [...prev.moveStatuses];
              newStatuses[prev.moveIndex] = 'done';
              const nextIndex = prev.moveIndex + 1;

              if (nextIndex >= moveInfos.length) {
                setTimeout(onComplete, 0);
                return { ...prev, moveIndex: nextIndex, moveStatuses: newStatuses, partialMoves: [] };
              }
              return { mode: 'executing', moveIndex: nextIndex, moveStatuses: newStatuses, partialMoves: [] };
            }

            const newStatuses = [...prev.moveStatuses];
            if (net === 0) {
              newStatuses[prev.moveIndex] = 'pending';
            } else {
              newStatuses[prev.moveIndex] = 'yellow';
            }
            return { ...prev, moveStatuses: newStatuses, partialMoves: newPartial };
          }
        }

        // Wrong face - enter error state
        // If there's partial progress on a double move, include those in wrongMoves for undo
        const wrongMoves = [...prev.partialMoves, actual];
        return {
          mode: 'error',
          moveIndex: prev.moveIndex,
          moveStatuses: prev.moveStatuses,
          partialMoves: [], // will be cleared after undo
          wrongMoves,
          undoIndex: 0,
        };
      }

      // Error state - user must undo wrong moves in reverse order
      const undoMoves = [...prev.wrongMoves].reverse().map(invertQuarterTurn);
      const expectedUndo = undoMoves[prev.undoIndex];

      if (actual === expectedUndo) {
        const nextUndoIndex = prev.undoIndex + 1;
        if (nextUndoIndex >= undoMoves.length) {
          // All undone, back to executing
          const newStatuses = [...prev.moveStatuses];
          newStatuses[prev.moveIndex] = 'pending';
          return {
            mode: 'executing',
            moveIndex: prev.moveIndex,
            moveStatuses: newStatuses,
            partialMoves: [],
          };
        }
        return { ...prev, undoIndex: nextUndoIndex };
      }

      // Additional wrong move while in error state
      // If this move cancels the last wrong move, remove both
      const lastWrong = prev.wrongMoves[prev.wrongMoves.length - 1];
      if (lastWrong && actual === invertQuarterTurn(lastWrong)) {
        const trimmed = prev.wrongMoves.slice(0, -1);
        if (trimmed.length === 0) {
          // All wrong moves cancelled, back to executing
          const newStatuses = [...prev.moveStatuses];
          newStatuses[prev.moveIndex] = 'pending';
          return {
            mode: 'executing',
            moveIndex: prev.moveIndex,
            moveStatuses: newStatuses,
            partialMoves: [],
          };
        }
        return { ...prev, wrongMoves: trimmed, undoIndex: 0 };
      }
      return { ...prev, wrongMoves: [...prev.wrongMoves, actual], undoIndex: 0 };
    });
  }, [moves, moveInfos, onComplete]);

  useEffect(() => {
    const sub = conn.events$.subscribe(handleMove);
    return () => sub.unsubscribe();
  }, [conn, handleMove]);

  if (moves.length === 0) return null;

  const undoMoves = state.mode === 'error'
    ? [...state.wrongMoves].reverse().map(invertQuarterTurn)
    : [];

  return (
    <Group gap={4} wrap="wrap">
      {state.mode === 'executing' && moves.map((move, i) => {
        const status = state.moveStatuses[i];
        const isCurrent = i === state.moveIndex;

        let color = 'gray.3';
        let fw: number | undefined;

        if (status === 'done') {
          color = 'dimmed';
        } else if (status === 'yellow') {
          color = 'yellow';
          fw = 700;
        } else if (isCurrent) {
          color = 'white';
          fw = 700;
        }

        return (
          <Text key={i} ff="monospace" fz="sm" c={color} fw={fw}>
            {move}
          </Text>
        );
      })}

      {state.mode === 'error' && (
        <>
          {moves.map((move, i) => {
            if (state.moveStatuses[i] !== 'done' && state.moveStatuses[i] !== 'yellow') return null;
            return (
              <Text key={i} ff="monospace" fz="sm" c={state.moveStatuses[i] === 'yellow' ? 'yellow' : 'dimmed'}>
                {move}
              </Text>
            );
          })}
          <Text ff="monospace" fz="sm" c="red" fw={700}>| Undo:</Text>
          {undoMoves.map((move, i) => {
            const isCompleted = i < state.undoIndex;
            const isCurrent = i === state.undoIndex;

            let color = 'gray.3';
            let fw: number | undefined;
            if (isCompleted) {
              color = 'dimmed';
            } else if (isCurrent) {
              color = 'red';
              fw = 700;
            }

            return (
              <Text key={`undo-${i}`} ff="monospace" fz="sm" c={color} fw={fw}>
                {move}
              </Text>
            );
          })}
        </>
      )}
    </Group>
  );
};

export default ScrambleGuide;
