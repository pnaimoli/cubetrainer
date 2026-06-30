import React, { useState, useEffect, useRef } from 'react';
import { Text, Group, Stack } from '@mantine/core';

export interface SolveTimerHandle {
  /** Call when the user makes their first move */
  firstMove: (time?: number) => void;
  /** Call when the solve is complete (uses Date.now()) */
  stop: () => void;
  /** Call when the solve is complete at a specific timestamp */
  stopAt: (time: number) => void;
  /** Get the current timing breakdown */
  getTimes: () => { inspectionMs: number; executionMs: number };
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(3);
}

const SolveTimer = React.forwardRef<SolveTimerHandle, {}>((_, ref) => {
  const startTime = useRef(Date.now());
  const firstMoveAt = useRef<number | null>(null);
  const endTime = useRef<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<number>();

  React.useImperativeHandle(ref, () => ({
    firstMove: (time?: number) => {
      if (firstMoveAt.current === null) {
        firstMoveAt.current = time ?? Date.now();
      }
    },
    stop: () => {
      endTime.current = Date.now();
      if (intervalRef.current !== undefined) clearInterval(intervalRef.current);
      setNow(Date.now());
    },
    stopAt: (time: number) => {
      endTime.current = time;
      if (intervalRef.current !== undefined) clearInterval(intervalRef.current);
      setNow(time);
    },
    getTimes: () => {
      const end = endTime.current ?? Date.now();
      const first = firstMoveAt.current ?? end;
      return {
        inspectionMs: first - startTime.current,
        executionMs: end - first,
      };
    },
  }));

  useEffect(() => {
    intervalRef.current = window.setInterval(() => setNow(Date.now()), 13);
    return () => {
      if (intervalRef.current !== undefined) clearInterval(intervalRef.current);
    };
  }, []);

  const current = endTime.current ?? now;
  const totalMs = current - startTime.current;
  const inspectionMs = firstMoveAt.current
    ? firstMoveAt.current - startTime.current
    : totalMs;
  const executionMs = firstMoveAt.current
    ? current - firstMoveAt.current
    : 0;

  return (
    <Stack gap={0} align="center">
      <Text ff="monospace" fw={600} fz="36px" lh={1} ta="center" style={{ minWidth: '7ch' }}>
        {formatTime(totalMs)}
      </Text>
      <Group justify="center" gap="lg" mt={4}>
        <Stack align="center" gap={0}>
          <Text fz={10} c="dimmed" lh={1}>Inspection</Text>
          <Text ff="monospace" fw={500} fz="sm" c={firstMoveAt.current ? 'dimmed' : undefined} lh={1.2} ta="center">
            {formatTime(inspectionMs)}
          </Text>
        </Stack>
        <Stack align="center" gap={0}>
          <Text fz={10} c="dimmed" lh={1}>Execution</Text>
          <Text ff="monospace" fw={500} fz="sm" c={!firstMoveAt.current ? 'dimmed' : undefined} lh={1.2} ta="center">
            {formatTime(executionMs)}
          </Text>
        </Stack>
      </Group>
    </Stack>
  );
});

export default SolveTimer;
