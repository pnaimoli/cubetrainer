import { useState, useEffect, useCallback, useRef } from 'react';
import { GanCubeConnection } from 'gan-web-bluetooth';
import { Group, Text } from '@mantine/core';
import { KPuzzle } from 'cubing/kpuzzle';
import { requestFacelets, computeTransitionMoves, simplifyMoves } from '../util/cubeState';
import ScrambleGuide from './ScrambleGuide';

interface DifferentialScrambleProps {
  conn: GanCubeConnection | null;
  kpuzzle: KPuzzle | null;
  scramble: string;
  phase: string;
  onScrambleComplete: () => void;
}

export default function DifferentialScramble({
  conn, kpuzzle, scramble, phase, onScrambleComplete,
}: DifferentialScrambleProps) {
  const [transitionMoves, setTransitionMoves] = useState<string[]>([]);
  const [computing, setComputing] = useState(false);
  const hasComputed = useRef(false);
  const scrambleRef = useRef(scramble);
  scrambleRef.current = scramble;

  const compute = useCallback(async (targetScramble: string) => {
    if (!kpuzzle || !conn) {
      setTransitionMoves(simplifyMoves(targetScramble.split(/\s+/).filter(Boolean)));
      hasComputed.current = true;
      return;
    }

    setComputing(true);
    try {
      const facelets = await requestFacelets(conn);
      const rawMoves = await computeTransitionMoves(facelets, targetScramble, kpuzzle);
      const simplified = simplifyMoves(rawMoves);
      if (scrambleRef.current === targetScramble) {
        if (simplified.length === 0) {
          hasComputed.current = true;
          onScrambleComplete();
          return;
        }
        setTransitionMoves(simplified);
      }
    } catch (err) {
      console.warn('Failed to compute transition, using raw scramble:', err);
      if (scrambleRef.current === targetScramble) {
        setTransitionMoves(targetScramble.split(/\s+/).filter(Boolean));
      }
    } finally {
      setComputing(false);
      hasComputed.current = true;
    }
  }, [kpuzzle, conn, onScrambleComplete]);

  // Recompute when scramble changes
  useEffect(() => {
    if (scramble) {
      hasComputed.current = false;
      setTransitionMoves([]);
      compute(scramble);
    }
  }, [scramble]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-compute when cube connects mid-session
  useEffect(() => {
    if (conn && scrambleRef.current && phase === 'scrambling') {
      compute(scrambleRef.current);
    }
  }, [conn]); // eslint-disable-line react-hooks/exhaustive-deps

  const differentialContent = (() => {
    if (!conn) {
      return null;
    }
    if (computing) {
      return <Text fz="sm" c="dimmed">computing...</Text>;
    }
    if (transitionMoves.length > 0) {
      return <ScrambleGuide moves={transitionMoves} conn={conn} onComplete={onScrambleComplete} />;
    }
    if (!hasComputed.current) {
      return <Text fz="sm" c="dimmed">computing...</Text>;
    }
    return <Text fz="sm" c="green" fw={700}>{phase === 'scrambling' ? 'already at target state' : 'done'}</Text>;
  })();

  return (
    <>
      <Text fz="sm" fw={700} c="dimmed" mt={4}>Full Scramble (White on U, Green on F):</Text>
      <Group gap={4} wrap="wrap">
        <Text fz="sm" ff="monospace" c="dimmed">{scramble}</Text>
      </Group>
      {conn && (
        <>
          <Text fz="sm" fw={700} c="dimmed" mt={4}>Differential (White on U, Green on F):</Text>
          <Group gap={4} wrap="wrap" align="center">
            {differentialContent}
          </Group>
        </>
      )}
    </>
  );
}
