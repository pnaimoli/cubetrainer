import React, { useState, useEffect, useRef } from 'react';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { useLocalStorage } from '@mantine/hooks';
import 'cubing/twisty';
import { TwistyPlayer } from 'cubing/twisty';
import { Alg } from 'cubing/alg';
import { AlgSet, Alg as Algorithm, Settings, CUBE_ROTATIONS } from './interfaces';
import { Box, Stack, Text, Badge, List, Center } from '@mantine/core';

interface TrainerViewProps {
  currentAlgSet: AlgSet;
  conn: GanCubeConnection | null;
}

const TrainerView: React.FC<TrainerViewProps> = ({ currentAlgSet, conn }) => {
  const [settings] = useLocalStorage<Settings>({ key: 'settings' });
  const [currentAlg, setCurrentAlg] = useState<Algorithm | null>(null);
  const [isSolved, setIsSolved] = useState<boolean>(false);
  const playerRef = useRef<TwistyPlayer>(null);

  const [randomAUF, setRandomAUF] = useState<string>('');
  const [randomAdF, setRandomAdF] = useState<string>('');
  const [randomRotations1, setRandomRotations1] = useState<string>('');
  const [fullColourNeutrality, setFullColourNeutrality] = useState<string>('');

  /////////////////////////////////////////////////////////////////////////////
  // useEffects
  /////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    if (settings?.randomAUF) {
      setRandomAUF(getRandomRotations('U', Math.floor(Math.random() * 4) + 1));
    } else {
      setRandomAUF('');
    }
  }, [settings?.randomAUF, currentAlg]);

  useEffect(() => {
    if (settings?.randomAdF) {
      setRandomAdF(getRandomRotations('d', Math.floor(Math.random() * 4) + 1));
    } else {
      setRandomAdF('');
    }
  }, [settings?.randomAdF, currentAlg]);

  useEffect(() => {
    if (settings?.randomRotations1) {
      setRandomRotations1(getRandomRotations(settings.randomRotations1, Math.floor(Math.random() * 4) + 1));
    } else {
      setRandomRotations1('');
    }
  }, [settings?.randomRotations1, currentAlg]);

  useEffect(() => {
    if (settings?.fullColourNeutrality) {
      let rotations = '';
      for (let i = 0; i < 6; i++) {
        const randomRotation = CUBE_ROTATIONS[Math.floor(Math.random() * CUBE_ROTATIONS.length)];
        rotations += ` ${randomRotation}`;
      }
      setFullColourNeutrality(rotations.trim());
    } else {
      setFullColourNeutrality('');
    }
  }, [settings?.fullColourNeutrality, currentAlg]);

  useEffect(() => {
    if (playerRef.current && currentAlg) {
      const setupAlg = computeSetupAlg();
      playerRef.current.experimentalSetupAlg = setupAlg;
      playerRef.current.alg = "";
    }
  }, [currentAlg, randomAUF, randomAdF, randomRotations1, fullColourNeutrality]);

  useEffect(() => {
    if (conn) {
      const handleCubeEvent = async (event: GanCubeEvent) => {
        if (event.type === "MOVE") {
          if (playerRef.current) {
            playerRef.current.experimentalAddMove(event.move);
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

  useEffect(() => {
    if (isSolved) {
      cycleAlgorithm();
      setIsSolved(false);
    }
  }, [isSolved]);

  useEffect(() => {
    if (currentAlgSet && currentAlgSet.algs.length > 0) {
      if (settings?.goInOrder) {
        setCurrentAlg(currentAlgSet.algs[0]);
      } else {
        const randomIndex = Math.floor(Math.random() * currentAlgSet.algs.length);
        setCurrentAlg(currentAlgSet.algs[randomIndex]);
      }
    }
  }, [currentAlgSet, settings?.goInOrder]);

  /////////////////////////////////////////////////////////////////////////////
  // member functions
  /////////////////////////////////////////////////////////////////////////////
  const getRandomRotations = (rotation: string, count: number): string => {
    let rotations = '';
    for (let i = 0; i < count; i++) {
      rotations += ` ${rotation}`;
    }
    return rotations.trim();
  };

  const cycleAlgorithm = async () => {
    if (!currentAlgSet || currentAlgSet.algs.length === 0) return;

    if (settings.goInOrder) {
      const currentIndex = currentAlgSet.algs.findIndex(alg => alg.name === currentAlg?.name);
      const nextIndex = (currentIndex + 1) % currentAlgSet.algs.length;
      setCurrentAlg(currentAlgSet.algs[nextIndex]);
    } else {
      const randomIndex = Math.floor(Math.random() * currentAlgSet.algs.length);
      setCurrentAlg(currentAlgSet.algs[randomIndex]);
    }

    if (playerRef.current) {
      playerRef.current.alg = "";
    }
  };

  const computeSetupAlg = () => {
    if (!currentAlg) return '';

    const algString = currentAlg.alg.join(' ');
    const parsedAlg = Alg.fromString(algString);
    const inverseAlg = parsedAlg.invert().toString();
    let setupAlg = '';

    if (settings.fullColourNeutrality) {
      setupAlg = fullColourNeutrality;
    } else {
      if (settings.firstRotation) {
        setupAlg += ` ${settings.firstRotation}`;
      }
      setupAlg += ` ${randomRotations1}`;
    }

    setupAlg = `${setupAlg.trim()} ${inverseAlg} ${randomAUF} ${randomAdF}`.trim();

    return setupAlg;
  };

  const checkIfSolved = async () => {
    if (playerRef.current) {
      const currentPattern = await playerRef.current.experimentalModel.currentPattern.get();
      const isSolved = currentPattern.experimentalIsSolved({
        ignoreCenterOrientation: true,
        ignorePuzzleOrientation: true,
      });
      setIsSolved(isSolved);
    }
  };

  return (
    <Box>
      <Stack align="center" spacing="md" style={{ marginBottom: '10px' }}>
        <Badge color={isSolved ? 'green' : 'red'}>{isSolved ? 'Solved' : 'Not Solved'}</Badge>
        <Text weight={500} size="lg">Algorithm Set: {currentAlgSet.name}</Text>
      </Stack>
      <Center style={{ marginBottom: '20px' }}>
        <twisty-player
          ref={playerRef}
          class="cube"
          visualization="PG3D"
          control-panel="none"
          background="none"
          puzzle="3x3x3"
          tempo-scale="4"
          hint-facelets="none"
          experimental-setup-alg={computeSetupAlg()}
          style={{ width: "300px", height: "300px" }}
        />
      </Center>
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
              <List.Item key={alg.name} onClick={() => setCurrentAlg(alg)}>
                {alg.name}
              </List.Item>
            ))}
          </List>
        </Stack>
      )}
    </Box>
  );
};

export default TrainerView;
