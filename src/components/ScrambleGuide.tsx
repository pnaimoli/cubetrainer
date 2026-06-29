import React, { useState, useEffect, useCallback } from 'react';
import { Group, Text } from '@mantine/core';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { parseMoveInfo, invertQuarterTurn, transition, GuideState } from '../util/scrambleGuideState';

interface ScrambleGuideProps {
  moves: string[];
  conn: GanCubeConnection;
  onComplete: () => void;
}

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
    setState(prev => {
      const result = transition(prev, event.move, moveInfos);
      if (result.completed) setTimeout(onComplete, 0);
      return result.state;
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
