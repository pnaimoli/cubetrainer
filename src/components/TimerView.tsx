import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@mantine/core';

interface TimerViewProps {
  startTime: number;
}

// hahahahahahaha
const formatTime = (time) => {
    let minutes = Math.floor(time / 60000);
    let remainingMiliseconds = time % 60000;
    let seconds = Math.floor(remainingMiliseconds / 1000);
    let miliseconds = remainingMiliseconds % 1000;

    if (minutes >= 1 && seconds < 10) seconds = "0" + seconds;
    if (miliseconds < 10) miliseconds = "0" + miliseconds;
    if (miliseconds < 100) miliseconds = "0" + miliseconds;
    if (minutes <= 0) return seconds + "." + miliseconds;
    return minutes + ":" + seconds + "." + miliseconds;
};

const TimerView: React.FC<TimerViewProps> = ({ startTime }) => {
  const [currentTime, setCurrentTime] = useState<number>(startTime);
  const timerCallbackId = useRef();

  useEffect(() => {
    timerCallbackId.current = setInterval(() => {
      setCurrentTime(Date.now());
    }, 63);

    return () => {clearInterval(timerCallbackId)};
  }, []);

  return (
    <Text ff="monospace" fw={600} fz="48px">{formatTime(currentTime - startTime)}</Text>
  );
};

export default TimerView;
