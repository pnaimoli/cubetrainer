import { useState, useEffect, useCallback, useRef } from 'react';
import { GanCubeConnection } from 'gan-web-bluetooth';
import { ActionIcon, Group, Text, Tooltip } from '@mantine/core';
import { TbCopy, TbCheck } from 'react-icons/tb';
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

function CopyScrambleButton({ scramble }: { scramble: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(scramble);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Tooltip label={copied ? 'Copied!' : 'Copy scramble'} withArrow>
      <ActionIcon variant="subtle" size="xs" color={copied ? 'green' : 'gray'} onClick={handleCopy}>
        {copied ? <TbCheck size={14} /> : <TbCopy size={14} />}
      </ActionIcon>
    </Tooltip>
  );
}

export default function DifferentialScramble({
  conn, kpuzzle, scramble, phase, onScrambleComplete,
}: DifferentialScrambleProps) {
  const [transitionMoves, setTransitionMoves] = useState<string[]>([]);
  const [computing, setComputing] = useState(false);
  const hasComputed = useRef(false);
  const scrambleRef = useRef(scramble);
  scrambleRef.current = scramble;
  const computingRef = useRef(false);

  const compute = useCallback(async (targetScramble: string) => {
    if (!kpuzzle || !conn) {
      setTransitionMoves(simplifyMoves(targetScramble.split(/\s+/).filter(Boolean)));
      hasComputed.current = true;
      return;
    }

    // Prevent concurrent GATT operations (BLE can only handle one at a time)
    if (computingRef.current) return;
    computingRef.current = true;
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
      computingRef.current = false;
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
      <Group gap={4} align="center" mt={4}>
        <Text fz="sm" fw={700} c="dimmed">Full Scramble (White on U, Green on F):</Text>
        <CopyScrambleButton scramble={scramble} />
      </Group>
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
