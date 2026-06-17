import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@mantine/core';

interface TimerViewProps {
  startTime: number;
  stopTime?: number | null;
}

const TimerView: React.FC<TimerViewProps> = ({ startTime, stopTime }) => {
  const [currentTime, setCurrentTime] = useState<number>(startTime);
  const timerCallbackId = useRef<number>();

  useEffect(() => {
    if (stopTime) {
      if (timerCallbackId.current !== undefined) {
        clearInterval(timerCallbackId.current);
      }
      setCurrentTime(stopTime);
      return;
    }

    timerCallbackId.current = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 13);

    return () => {
      if (timerCallbackId.current !== undefined) {
        clearInterval(timerCallbackId.current);
      }
    };
  }, [stopTime]);

  return (
    <Text ff="monospace" fw={600} fz="48px">
      {((currentTime - startTime)/1000).toFixed(3)}
    </Text>
  );
};

export default TimerView;
