import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@mantine/core';

interface TimerViewProps {
  startTime: number;
}

const TimerView: React.FC<TimerViewProps> = ({ startTime }) => {
  const [currentTime, setCurrentTime] = useState<number>(startTime);
  const timerCallbackId = useRef<number>();

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
      {((currentTime - startTime)/1000).toFixed(3)}
    </Text>
  );
};

export default TimerView;
