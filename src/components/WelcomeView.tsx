import React from 'react';
import { Text, Stack, List } from '@mantine/core';

const WelcomeView: React.FC = () => (
  <Stack align="center" justify="center" style={{ height: '100%' }} maw={600} mx="auto">
    <Text fz="xl" fw={700}>Welcome!</Text>
    <Text ta="center">
      This is my Cube Trainer app. It's a highly specific trainer that probably only I care about. It's meant to be used with a Gan 12 cube.
      <br/>
      Practice crosses, xcrosses, or custom algs. Drill specific situations with very low downtime in between.
    </Text>
    <Text fz="sm" fw={700}>Features:</Text>
    <List size="sm" spacing={4}>
      <List.Item><b>Cross</b> - random scrambles with optimal cross solutions shown. Filter by move count, train on any face, add random preorientation. Differential scrambles with a connected cube.</List.Item>
      <List.Item><b>XCross</b> - same idea but for xcross. Filter by slot, move count, and min extra moves over cross optimal.</List.Item>
      <List.Item><b>FR+FL Slot Simul</b> - drill inserting the two front F2L pairs from random positions. Tracks optimal vs your move count.</List.Item>
      <List.Item><b>OLL Prediction</b> - practice predicting OLL during your last F2L pair.</List.Item>
      <List.Item><b>Custom Alg Sets</b> - import any set of algs and drill them with shuffle/random/ordered modes. Auto-advance on solve, stats, inspection/execution splits, the works.</List.Item>
    </List>
  </Stack>
);

export default WelcomeView;
