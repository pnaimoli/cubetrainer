import React from 'react';
import { Text, Stack } from '@mantine/core';

const WelcomeView: React.FC = () => (
  <Stack align="center" justify="center" style={{ height: '100%' }}>
    <Text fz="xl" fw={700}>Welcome!</Text>
    <Text ta="center">
      This is the Cube Trainer app. Use it to practice and improve your speedcubing algorithms.
      <br />
      Select an algorithm set to get started, or create a new one. You can connect your Gan 12 Cube for real-time tracking.
    </Text>
  </Stack>
);

export default WelcomeView;
