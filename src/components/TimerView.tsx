import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@mantine/core';

interface TimerViewProps {
  startTime: number;
}

export interface TimerViewHandle {
  stop: () => void;
  stopAt: (time: number) => void;
}

const TimerView = React.forwardRef<TimerViewHandle, TimerViewProps>(({ startTime }, ref) => {
  const [currentTime, setCurrentTime] = useState<number>(startTime);
  const timerCallbackId = useRef<number>();

  React.useImperativeHandle(ref, () => ({
    stop: () => {
      if (timerCallbackId.current !== undefined) {
        clearInterval(timerCallbackId.current);
      }
      setCurrentTime(Date.now());
    },
    stopAt: (time: number) => {
      if (timerCallbackId.current !== undefined) {
        clearInterval(timerCallbackId.current);
      }
      setCurrentTime(time);
    },
  }));

  useEffect(() => {
    timerCallbackId.current = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 13);

    return () => {
      if (timerCallbackId.current !== undefined) {
        clearInterval(timerCallbackId.current);
      }
    };
  }, []);

  return (
    <Text ff="monospace" fw={600} fz="48px" lh={1}>
      {((currentTime - startTime)/1000).toFixed(3)}
    </Text>
  );
});

export default TimerView;
