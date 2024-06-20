import React, { useState, useEffect } from 'react';
import { connectGanCube, GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { useLocalStorage } from '@mantine/hooks';
import 'cubing/twisty';
import { Alg } from 'cubing/alg';
import { AlgSet, Alg as Algorithm, Settings } from './interfaces';
import { Box, Stack, Text, Badge, List, ListItem, Flex } from '@mantine/core';

interface TrainerViewProps {
  currentAlgSet: AlgSet;
  conn: GanCubeConnection | null;
}

const TrainerView: React.FC<TrainerViewProps> = ({ currentAlgSet, conn }) => {
  const [settings, setSettings] = useLocalStorage<Settings>({ key: 'settings' });
  const [currentAlg, setCurrentAlg] = useState<Algorithm | null>(null);
  const [isSolved, setIsSolved] = useState<boolean>(true);

  useEffect(() => {
    if (currentAlgSet && currentAlgSet.algs.length > 0) {
      setCurrentAlg(currentAlgSet.algs[0]);
    }
  }, [currentAlgSet]);

  useEffect(() => {
    const player = document.querySelector('twisty-player');
    if (player && currentAlg) {
      const algString = currentAlg.alg.join(' ');
      const parsedAlg = Alg.fromString(algString);
      const inverseAlg = parsedAlg.invert().toString();
      (player as any).experimentalSetupAlg = inverseAlg;
    }
  }, [currentAlg]);

  useEffect(() => {
    if (conn) {
      const handleCubeEvent = async (event: GanCubeEvent) => {
        if (event.type === "MOVE") {
          const player = document.querySelector('twisty-player');
          if (player) {
            (player as any).experimentalAddMove(event.move);
            await checkIfSolved();
          }
        }
      };

      const sub = conn.events$.subscribe(handleCubeEvent);

      return () => {
        sub.unsubscribe();
      };
    }
  }, [conn]);

  const checkIfSolved = async () => {
    const player = document.querySelector('twisty-player');
    if (player) {
      const currentPattern = await player.experimentalModel.currentPattern.get();
      const isSolved = currentPattern.experimentalIsSolved({
        ignoreCenterOrientation: true,
        ignorePuzzleOrientation: true,
      });
      setIsSolved(isSolved);
    }
  };

  useEffect(() => {
    checkIfSolved();
  }, [currentAlg]);

  return (
    <Box>
      <Stack align="center" spacing="md" style={{ marginBottom: '10px' }}>
        <Badge color={isSolved ? 'green' : 'red'}>{isSolved ? 'Solved' : 'Not Solved'}</Badge>
        <Text weight={500} size="lg">Algorithm Set: {currentAlgSet.name}</Text>
      </Stack>
      <Flex justify="center" style={{ marginBottom: '20px' }}>
        <twisty-player
          class="cube"
          visualization="PG3D"
          control-panel="none"
          background="none"
          puzzle="3x3x3"
          tempo-scale="4"
          hint-facelets="none"
          style={{ width: "300px", height: "300px" }}
        />
      </Flex>
      {currentAlgSet && (
        <Stack>
          {currentAlg && (
            <Box>
              <Text>Current Algorithm: {currentAlg.name}</Text>
              <Text>{currentAlg.alg.join(' ')}</Text>
            </Box>
          )}
          <List>
            {currentAlgSet.algs.map((alg) => (
              <ListItem key={alg.name} onClick={() => setCurrentAlg(alg)}>
                {alg.name}
              </ListItem>
            ))}
          </List>
        </Stack>
      )}
    </Box>
  );
};

export default TrainerView;
