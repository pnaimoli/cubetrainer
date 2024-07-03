import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@mantine/core';

interface TimerViewProps {
  startTime: number;
}

const formatTime = (time: number): string => {
  const minutes = Math.floor(time / 60000);
  const remainingMilliseconds = time % 60000;
  let seconds: string | number = Math.floor(remainingMilliseconds / 1000);
  let milliseconds: string | number = remainingMilliseconds % 1000;

  milliseconds = milliseconds.toString().padStart(3, '0');

  if (minutes <= 0) return seconds + "." + milliseconds;

  seconds = seconds.toString().padStart(2, '0');
  return minutes + ":" + seconds + "." + milliseconds;
};

const TimerView: React.FC<TimerViewProps> = ({ startTime }) => {
  const [currentTime, setCurrentTime] = useState<number>(startTime);
  const timerCallbackId = useRef();

  useEffect(() => {
    timerCallbackId.current = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 13);

    return () => {
      if (timerCallbackId.current !== null) {
        clearInterval(timerCallbackId.current);
      }
    };
  }, []);

  return (
    <Text ff="monospace" fw={600} fz="48px">
      {formatTime(currentTime - startTime)}
    </Text>
  );
};

export default TimerView;
