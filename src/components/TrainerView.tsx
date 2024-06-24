import React, { useState, useEffect, useRef } from 'react';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { Box, Stack, Text, Badge, Title, Center, Group } from '@mantine/core';
import 'cubing/twisty';
import { TwistyPlayer } from 'cubing/twisty';
import { KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

import { CTAlg } from '../util/CTAlg';
import { AlgSet, Alg as Algorithm, SolvedState, CUBE_ROTATIONS } from '../util/interfaces';
import { isPatternSolved } from '../util/SolveChecker';
import { generateStickeringMask } from '../util/StickerMask';

interface TrainerViewProps {
  currentAlgSet: AlgSet;
  conn: GanCubeConnection | null;
  settings: Settings;
  initialAlg?: Algorithm; // Add initialAlg prop
}

const TrainerView: React.FC<TrainerViewProps> = ({ currentAlgSet, conn, settings, initialAlg }) => {
  const [currentAlg, setCurrentAlg] = useState<Algorithm | null>(null); // Set initialAlg as the initial state
  const [isSolved, setIsSolved] = useState<boolean>(false);
  const [solvedStateMap, setSolvedStateMap] = useState<Record<string, boolean>>({});
  const [moves, setMoves] = useState<string[]>([]);
  const [setupAlg, setSetupAlg] = useState<string>("");
  const playerRef = useRef<TwistyPlayer>(null);
  const [kpuzzle, setKPuzzle] = useState<KPuzzle | null>(null);

  const [randomAUF, setRandomAUF] = useState<string>('');
  const [randomYs, setRandomYs] = useState<string>('');
  const [randomRotations1, setRandomRotations1] = useState<string>('');
  const [fullColourNeutrality, setFullColourNeutrality] = useState<string>('');

  // ... (other useEffects and functions)

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
  }, []);

  useEffect(() => {
    if (conn) {
      const handleCubeEvent = async (event: GanCubeEvent) => {
        if (event.type === "MOVE") {
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

  // This needs to be really high up here so it gets called first
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.alg = "";
    }
    setMoves([]);
    setSetupAlg("");
  }, [currentAlg]);

  useEffect(() => {
    if (initialAlg) {
      setCurrentAlg(initialAlg);
    }
  }, [initialAlg]);

  /////////////////////////////////////////////////////////////////////////////
  // settings related useEffects
  /////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    if (settings.playlistMode === 'ordered') {
      setCurrentAlg(currentAlgSet.algs[0]);
    } else {
      const randomIndex = Math.floor(Math.random() * currentAlgSet.algs.length);
      setCurrentAlg(currentAlgSet.algs[randomIndex]);
    }
  }, [currentAlgSet, settings.playlistMode]);

  useEffect(() => {
    if (settings.randomAUF) {
      setRandomAUF(getRandomRotations('U', Math.floor(Math.random() * 4) + 1));
    } else {
      setRandomAUF('');
    }
  }, [settings.randomAUF, currentAlg]);

  useEffect(() => {
    if (settings.randomYs) {
      setRandomYs(getRandomRotations('y', Math.floor(Math.random() * 4) + 1));
    } else {
      setRandomYs('');
    }
  }, [settings.randomYs, currentAlg]);

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

      setupAlg = `${setupAlg.trim()} ${inverseAlg} ${randomAUF} ${randomYs}`.trim();

      return setupAlg;
    };

    if (currentAlg) {
      const newSetupAlg = computeSetupAlg();
      setSetupAlg(newSetupAlg);
    }
  }, [currentAlg, randomAUF, randomYs, randomRotations1, fullColourNeutrality,
      settings.firstRotation, settings.fullColourNeutrality, settings.mirrorAcrossM,
      settings.mirrorAcrossS, settings.randomizeMirrorAcrossM, settings.randomizeMirrorAcrossS]);

  useEffect(() => {
    if (!settings.useMaskings) {
      playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(null);
      return;
    }
    if (!playerRef.current) return;
    if (!kpuzzle) return;
    if (!currentAlg) return;
    const setupPattern = kpuzzle.defaultPattern().applyAlg(setupAlg);
    const stickerMask = generateStickeringMask(setupPattern, currentAlg.solved);
    playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(stickerMask);
   }, [setupAlg, currentAlg, kpuzzle, settings.useMaskings]);

  /////////////////////////////////////////////////////////////////////////////
  // solution-related useEffects
  /////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    if (!currentAlg || setupAlg === "" || !kpuzzle) return;

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
    if (!isSolved) return;

    if (settings.playlistMode === 'ordered') {
      const currentIndex = currentAlgSet.algs.findIndex(alg => alg.name === currentAlg?.name);
      const nextIndex = (currentIndex + 1) % currentAlgSet.algs.length;
      setCurrentAlg(currentAlgSet.algs[nextIndex]);
    } else {
      const randomIndex = Math.floor(Math.random() * currentAlgSet.algs.length);
      setCurrentAlg(currentAlgSet.algs[randomIndex]);
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
      <Center><Title>Algorithm Set: {currentAlgSet.name}</Title></Center>
      <Stack align="center" spacing="md" style={{ marginBottom: '10px' }}>
        <Group gap="xs">
          {Object.keys(SolvedState)
            .filter((key) => !isNaN(Number(SolvedState[key as keyof typeof SolvedState])))
            .map((key) => {
              const solvedStateValue = SolvedState[key as keyof typeof SolvedState];
              const isActive = (solvedStateValue & (currentAlg?.solved || 0)) === solvedStateValue;
              return (
                <Badge
                  key={key}
                  color={solvedStateMap[key] ? 'green' : 'gray'}
                  bd={isActive ? '1px solid var(--mantine-primary-color-5)': 'none'}
                >
                  {key}
                </Badge>
              );
            })}
        </Group>
      </Stack>
      <Center style={{ marginBottom: '20px' }}>
        <twisty-player
          ref={playerRef}
          visualization="PG3D"
          control-panel="none"
          background="none"
          puzzle="3x3x3"
          tempo-scale="4"
          hint-facelets={settings.showHintFacelets ? "true" : "none"}
          experimental-setup-alg={setupAlg??''}
          style={{ width: "300px", height: "300px" }}
        />
      </Center>
      {currentAlg && (
        <Box>
          <Text>Current Algorithm: {currentAlg.name}</Text>
          <Text>{currentAlg.alg.join(' ')}</Text>
        </Box>
      )}
    </Box>
  );
};

export default TrainerView;
