import React, { useState, useEffect, useRef } from 'react';
import { Text, Group, Stack } from '@mantine/core';

export interface SolveTimerHandle {
  /** Mark the beginning of inspection (starts the clock) */
  start: (time?: number) => void;
  /** Call when the user makes their first move */
  firstMove: (time?: number) => void;
  /** Call when the solve is complete (uses Date.now()) */
  stop: () => void;
  /** Call when the solve is complete at a specific timestamp */
  stopAt: (time: number) => void;
  /** Reset the timer display to 0 without starting */
  reset: () => void;
  /** Get the current timing breakdown */
  getTimes: () => { inspectionMs: number; executionMs: number };
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(3);
}

interface SolveTimerProps {
  /** When true (default), timer starts counting on mount. When false, stays at 0 until start() is called. */
  autoStart?: boolean;
}

const SolveTimer = React.forwardRef<SolveTimerHandle, SolveTimerProps>(({ autoStart = true }, ref) => {
  // Initialize startTime synchronously so the first render already has it,
  // avoiding a negative totalMs when parent re-renders before the interval fires.
  const startTime = useRef<number | null>(autoStart ? Date.now() : null);
  const firstMoveAt = useRef<number | null>(null);
  const endTime = useRef<number | null>(null);
  const [now, setNow] = useState(() => startTime.current ?? Date.now());
  const intervalRef = useRef<number>();

  const startInterval = () => {
    if (intervalRef.current === undefined) {
      intervalRef.current = window.setInterval(() => setNow(Date.now()), 13);
    }
  };

  React.useImperativeHandle(ref, () => ({
    start: (time?: number) => {
      const t = time ?? Date.now();
      startTime.current = t;
      firstMoveAt.current = null;
      endTime.current = null;
      if (intervalRef.current !== undefined) { clearInterval(intervalRef.current); intervalRef.current = undefined; }
      setNow(t);
      startInterval();
    },
    firstMove: (time?: number) => {
      if (firstMoveAt.current === null) {
        if (!startTime.current) {
          startTime.current = time ?? Date.now();
          startInterval();
        }
        firstMoveAt.current = time ?? Date.now();
      }
    },
    stop: () => {
      if (endTime.current !== null) return; // Already stopped
      endTime.current = Date.now();
      if (intervalRef.current !== undefined) { clearInterval(intervalRef.current); intervalRef.current = undefined; }
      setNow(Date.now());
    },
    stopAt: (time: number) => {
      endTime.current = time;
      if (intervalRef.current !== undefined) { clearInterval(intervalRef.current); intervalRef.current = undefined; }
      setNow(time);
    },
    reset: () => {
      startTime.current = null;
      firstMoveAt.current = null;
      endTime.current = null;
      if (intervalRef.current !== undefined) { clearInterval(intervalRef.current); intervalRef.current = undefined; }
      setNow(Date.now());
    },
    getTimes: () => {
      const start = startTime.current ?? Date.now();
      const end = endTime.current ?? Date.now();
      const first = firstMoveAt.current ?? end;
      return {
        inspectionMs: first - start,
        executionMs: end - first,
      };
    },
  }));

  useEffect(() => {
    if (autoStart) {
      startInterval();
    }
    return () => {
      if (intervalRef.current !== undefined) { clearInterval(intervalRef.current); intervalRef.current = undefined; }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = startTime.current;
  const current = endTime.current ?? now;
  const totalMs = start ? current - start : 0;
  const inspectionMs = start && firstMoveAt.current
    ? firstMoveAt.current - start
    : totalMs;
  const executionMs = firstMoveAt.current
    ? current - firstMoveAt.current
    : 0;

  return (
    <Stack gap={0} align="center">
      <Text ff="monospace" fw={600} fz="48px" lh={1} ta="center" style={{ minWidth: '7ch' }}>
        {formatTime(totalMs)}
      </Text>
      <Group justify="center" gap="lg" mt={4}>
        <Stack align="center" gap={0}>
          <Text fz="xs" c="dimmed" lh={1}>Inspection</Text>
          <Text ff="monospace" fw={500} fz="md" c={firstMoveAt.current ? 'dimmed' : undefined} lh={1.3} ta="center">
            {formatTime(inspectionMs)}
          </Text>
        </Stack>
        <Stack align="center" gap={0}>
          <Text fz="xs" c="dimmed" lh={1}>Execution</Text>
          <Text ff="monospace" fw={500} fz="md" c={!firstMoveAt.current ? 'dimmed' : undefined} lh={1.3} ta="center">
            {formatTime(executionMs)}
          </Text>
        </Stack>
      </Group>
    </Stack>
  );
});

export default SolveTimer;
