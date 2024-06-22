import React, { useState, useEffect, useRef } from 'react';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { Box, Stack, Text, Badge, List, Center, Flex } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import 'cubing/twisty';
import { TwistyPlayer } from 'cubing/twisty';
import { KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

import { CTAlg } from './CTAlg';
import { AlgSet, Alg as Algorithm, settings, SolvedState, CUBE_ROTATIONS } from './interfaces';
import { isPatternSolved } from './SolveChecker';

interface TrainerViewProps {
  currentAlgSet: AlgSet;
  conn: GanCubeConnection | null;
}

const TrainerView: React.FC<TrainerViewProps> = ({ currentAlgSet, conn, settings }) => {
  const [currentAlg, setCurrentAlg] = useState<Algorithm | null>(null);
  const [isSolved, setIsSolved] = useState<boolean>(false);
  const [solvedStateMap, setSolvedStateMap] = useState<Record<string, boolean>>({});
  const [moves, setMoves] = useState<string[]>([]);
  const [setupAlg, setSetupAlg] = useState<string | null>(null);
  const playerRef = useRef<TwistyPlayer>(null);
  const [kpuzzle, setKPuzzle] = useState<KPuzzle | null>(null);

  const [randomAUF, setRandomAUF] = useState<string>('');
  const [randomAdF, setRandomAdF] = useState<string>('');
  const [randomRotations1, setRandomRotations1] = useState<string>('');
  const [fullColourNeutrality, setFullColourNeutrality] = useState<string>('');

  /////////////////////////////////////////////////////////////////////////////
  // mounting useEffects
  /////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    const fetchPuzzle = async () => {
      try {
        const loadedKPuzzle: KPuzzle = await cube3x3x3.kpuzzle();
        setKPuzzle(loadedKPuzzle);
      } catch (error) {
        console.error("Error loading puzzle:", error);
      }
    };

    fetchPuzzle();
  }, []); // Empty dependency array to run once on mount

  useEffect(() => {
    if (conn) {
      const handleCubeEvent = async (event: GanCubeEvent) => {
        if (event.type === "MOVE") {
          // Need to do this because of animation reasons.
          playerRef.current.experimentalAddMove(event.move);
          setMoves(prevMoves => [...prevMoves, event.move]);
        }
      };

      const sub = conn.events$.subscribe(handleCubeEvent);

      return () => {
        sub.unsubscribe();
      };
    }
  }, [conn]);

  /////////////////////////////////////////////////////////////////////////////
  // settings related useEffects
  /////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    if (currentAlgSet && currentAlgSet.algs.length > 0) {
      if (settings.goInOrder) {
        setCurrentAlg(currentAlgSet.algs[0]);
      } else {
        const randomIndex = Math.floor(Math.random() * currentAlgSet.algs.length);
        setCurrentAlg(currentAlgSet.algs[randomIndex]);
      }
    }
  }, [currentAlgSet, settings.goInOrder]);

  useEffect(() => {
    if (settings.randomAUF) {
      setRandomAUF(getRandomRotations('U', Math.floor(Math.random() * 4) + 1));
    } else {
      setRandomAUF('');
    }
  }, [settings.randomAUF, currentAlg]);

  useEffect(() => {
    if (settings.randomAdF) {
      setRandomAdF(getRandomRotations('d', Math.floor(Math.random() * 4) + 1));
    } else {
      setRandomAdF('');
    }
  }, [settings.randomAdF, currentAlg]);

  useEffect(() => {
    if (settings.randomRotations1) {
      setRandomRotations1(getRandomRotations(settings.randomRotations1, Math.floor(Math.random() * 4) + 1));
    } else {
      setRandomRotations1('');
    }
  }, [settings.randomRotations1, currentAlg]);

  useEffect(() => {
    if (settings.fullColourNeutrality) {
      let rotations = '';
      for (let i = 0; i < 6; i++) {
        const randomRotation = CUBE_ROTATIONS[Math.floor(Math.random() * CUBE_ROTATIONS.length)];
        rotations += ` ${randomRotation}`;
      }
      setFullColourNeutrality(rotations.trim());
    } else {
      setFullColourNeutrality('');
    }
  }, [settings.fullColourNeutrality, currentAlg]);

  useEffect(() => {
    const computeSetupAlg = () => {
      if (!currentAlg) return '';

      let algString = currentAlg.alg.join(' ');
      let ctAlg = new CTAlg(algString);

      // Mirror across M if settings are enabled
      if (settings.mirrorAcrossM) {
        if (settings.randomizeMirrorAcrossM) {
          if (Math.random() < 0.5) {
            algString = ctAlg.mirror().toString();
          }
        } else {
          algString = ctAlg.mirror().toString();
        }
      }

      ctAlg = new CTAlg(algString); // Recreate CTAlg with potentially mirrored moves

      // Mirror across S if settings are enabled
      if (settings.mirrorAcrossS) {
        if (settings.randomizeMirrorAcrossS) {
          if (Math.random() < 0.5) {
            algString = ctAlg.mirrorOverS().toString();
          }
        } else {
          algString = ctAlg.mirrorOverS().toString();
        }
      }

      const parsedAlg = CTAlg.fromString(algString);
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

    if (currentAlg) {
      const newSetupAlg = computeSetupAlg();
      setSetupAlg(newSetupAlg);
    }
  }, [currentAlg, randomAUF, randomAdF, randomRotations1, fullColourNeutrality,
      settings.firstRotation, settings.fullColourNeutrality, settings.mirrorAcrossM,
      settings.mirrorAcrossS, settings.randomizeMirrorAcrossM, settings.randomizeMirrorAcrossS]);

  /////////////////////////////////////////////////////////////////////////////
  // solution-related useEffects
  /////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    if (playerRef.current && moves.length == 0) {
      playerRef.current.alg = "";
    }
  }, [moves]);

  useEffect(() => {
    if (!currentAlg || !setupAlg) return;
    const currentPattern = kpuzzle.defaultPattern().applyAlg(setupAlg).applyAlg(moves.join(' '));
    const newSolvedStateMap: Record<string, boolean> = {};

    Object.keys(SolvedState)
      .filter((key) => !isNaN(Number(SolvedState[key as keyof typeof SolvedState])))
      .forEach((key) => {
        newSolvedStateMap[key] = isPatternSolved(currentPattern, SolvedState[key as keyof typeof SolvedState]);
      });

    setSolvedStateMap(newSolvedStateMap);
    setIsSolved(isPatternSolved(currentPattern, currentAlg?.solved ?? SolvedState.FULL));
  }, [kpuzzle, currentAlg, moves, setupAlg]);

  useEffect(() => {
    if (isSolved) {
      if (settings.goInOrder) {
        const currentIndex = currentAlgSet.algs.findIndex(alg => alg.name === currentAlg?.name);
        const nextIndex = (currentIndex + 1) % currentAlgSet.algs.length;
        setCurrentAlg(currentAlgSet.algs[nextIndex]);
      } else {
        const randomIndex = Math.floor(Math.random() * currentAlgSet.algs.length);
        setCurrentAlg(currentAlgSet.algs[randomIndex]);
      }

      // Reset moves when cycling to a new algorithm
      setMoves([]);
      setSetupAlg(null);
      setIsSolved(false);
    }
  }, [isSolved]);

  /////////////////////////////////////////////////////////////////////////////
  // helper functions
  /////////////////////////////////////////////////////////////////////////////
  const getRandomRotations = (rotation: string, count: number): string => {
    let rotations = '';
    for (let i = 0; i < count; i++) {
      rotations += ` ${rotation}`;
    }
    return rotations.trim();
  };

  return (
    <Box>
      <Stack align="center" spacing="md" style={{ marginBottom: '10px' }}>
        <Flex gap="xs">
          {Object.keys(SolvedState)
            .filter((key) => !isNaN(Number(SolvedState[key as keyof typeof SolvedState])))
            .map((key) => {
              const solvedStateValue = SolvedState[key as keyof typeof SolvedState];
              const isActive = (solvedStateValue & (currentAlg?.solved || 0)) === solvedStateValue;
              return (
                <Badge
                  key={key}
                  color={solvedStateMap[key] ? 'green' : 'gray'}
                  style={{
                    border: isActive ? '2px solid blue' : 'none',
                    padding: '0 8px'
                  }}
                >
                  {key}
                </Badge>
              );
            })}
        </Flex>
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
          experimental-setup-alg={setupAlg??''}
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
