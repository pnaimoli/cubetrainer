import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { Grid, Card, Skeleton, Text, Badge, Title, Center, Group, Stack } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import 'cubing/twisty';
import { TwistyPlayer } from 'cubing/twisty';
import { KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

import { CTAlg } from '../util/CTAlg';
import { AlgSet, Alg as Algorithm, SolvedState, CUBE_ROTATIONS, SolveStat } from '../util/interfaces';
import { isPatternSolved } from '../util/SolveChecker';
import { generateStickeringMask } from '../util/StickeringMask';
import { SummaryStatsView, TimesListView } from './StatsViews';
import TimerView from './TimerView';

const initializeCurrentAlg = (initialAlg: Algorithm | undefined, currentAlgSet: AlgSet, settings: Settings): Algorithm => {
  if (initialAlg) {
    return initialAlg;
  } else if (settings.playlistMode === 'ordered') {
    return currentAlgSet.algs[0];
  } else {
    const randomIndex = Math.floor(Math.random() * currentAlgSet.algs.length);
    return currentAlgSet.algs[randomIndex];
  }
};

const recomputeRandomUs = (randomAUF: boolean): number => {
  return randomAUF ? Math.floor(Math.random() * 4) : 0;
};

const recomputeRandomYs = (randomYs: boolean): number => {
  return randomYs ? Math.floor(Math.random() * 4) : 0;
};

const recomputePreorientationMoves = (
  fullColourNeutrality: boolean,
  firstRotation: string | undefined,
  randomRotations1: string | undefined
): Move[] => {
  const preorientationMoves: Move[] = [];

  if (fullColourNeutrality) {
    for (let i = 0; i < 6; i++) {
      const randomRotation = CUBE_ROTATIONS[Math.floor(Math.random() * CUBE_ROTATIONS.length)];
      preorientationMoves.push({ move: randomRotation, timeOfMove: Date.now() });
    }
  } else {
    if (firstRotation) {
      preorientationMoves.push({ move: firstRotation, timeOfMove: Date.now() });
    }
    if (randomRotations1) {
      const randomRotations = Math.floor(Math.random() * 4);
      if (randomRotations === 0) {
        // Do nothing
      } else if (randomRotations === 1) {
        preorientationMoves.push({ move: randomRotations1, timeOfMove: Date.now() });
      } else {
        preorientationMoves.push({ move: `${randomRotations1}${randomRotations}`, timeOfMove: Date.now() });
      }
    }
  }

  return preorientationMoves;
};

const recomputeMirrorAcrossM = (mirrorAcrossM: boolean, randomizeMirrorAcrossM: boolean): boolean => {
  if (!mirrorAcrossM) {
    return false;
  } else if (randomizeMirrorAcrossM) {
    return Math.random() < 0.5;
  } else {
    return true;
  }
};

const recomputeMirrorAcrossS = (mirrorAcrossS: boolean, randomizeMirrorAcrossS: boolean): boolean => {
  if (!mirrorAcrossS) {
    return false;
  } else if (randomizeMirrorAcrossS) {
    return Math.random() < 0.5;
  } else {
    return true;
  }
};

interface Move {
  move: string;
  timeOfMove: number;
}

interface TrainerViewProps {
  currentAlgSet: AlgSet;
  conn: GanCubeConnection | null;
  settings: Settings;
  initialAlg?: Algorithm;
}

///////////////////////////////////////////////////////////////////////////////
// TrainerView
///////////////////////////////////////////////////////////////////////////////
const TrainerView: React.FC<TrainerViewProps> = ({ currentAlgSet, conn, settings, initialAlg }) => {
  const [kpuzzle, setKpuzzle] = useState<KPuzzle | null>(null);
  const [currentAlg, setCurrentAlg] = useState<Algorithm>(() => initializeCurrentAlg(initialAlg, currentAlgSet, settings));
  const [moves, setMoves] = useState<Move[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [preorientationMoves, setPreorientationMoves] = useState<Move[]>(recomputePreorientationMoves(settings));
  const [randomUs, setRandomUs] = useState<number>(recomputeRandomUs(settings));
  const [randomYs, setRandomYs] = useState<number>(recomputeRandomYs(settings));
  const [mirrorAcrossM, setMirrorAcrossM] = useState<boolean>(recomputeMirrorAcrossM(settings));
  const [mirrorAcrossS, setMirrorAcrossS] = useState<boolean>(recomputeMirrorAcrossS(settings));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [stats, setStats] = useLocalStorage<{ [key: string]: SolveStat[] }>({ key: 'stats', defaultValue: {} });
  const playerRef = useRef<TwistyPlayer>(null);

  const setupAlg = useMemo(() => {
    // First compute what the inverse of our alg needs to be,
    // subject to potentially mirroring across a couple axes
    let algString = currentAlg.alg.join(' ');

    if (mirrorAcrossM)
      algString = (new CTAlg(algString)).mirror().toString();
    if (mirrorAcrossS)
      algString = (new CTAlg(algString)).mirrorOverS().toString();

    const inverseAlg = (new CTAlg(algString)).invert().toString();

    const preorientationString = preorientationMoves.map(move => move.move).join(' ');

    let postMoves = '';
    if (randomUs === 1) {
      postMoves += ' U';
    } else if (randomUs === 2) {
      postMoves += ` U2`;
    } else if (randomUs === 3) {
      postMoves += ` U'`;
    }

    if (randomYs === 1) {
      postMoves += ' y';
    } else if (randomYs === 2) {
      postMoves += ` y2`;
    } else if (randomYs === 3) {
      postMoves += ` y'`;
    }

    return `${preorientationString} ${inverseAlg} ${postMoves}`.replace(/\s+/g, ' ').trim();
  }, [currentAlg, preorientationMoves, randomUs, randomYs, mirrorAcrossM, mirrorAcrossS]);

  const effectiveSolvedState = useMemo(() => {
    const MIRROR_ACROSS_M_MAPPING: Record<number, number> = {
      [SolvedState.F2LFR]: SolvedState.F2LFL,
      [SolvedState.F2LFL]: SolvedState.F2LFR,
      [SolvedState.F2LBR]: SolvedState.F2LBL,
      [SolvedState.F2LBL]: SolvedState.F2LBR,
    };

    const MIRROR_ACROSS_S_MAPPING: Record<number, number> = {
      [SolvedState.F2LFR]: SolvedState.F2LBR,
      [SolvedState.F2LBR]: SolvedState.F2LFR,
      [SolvedState.F2LFL]: SolvedState.F2LBL,
      [SolvedState.F2LBL]: SolvedState.F2LFL,
    };

    const Y_ROTATION_MAPPING: Record<number, number> = {
      [SolvedState.F2LFR]: SolvedState.F2LFL,
      [SolvedState.F2LFL]: SolvedState.F2LBL,
      [SolvedState.F2LBL]: SolvedState.F2LBR,
      [SolvedState.F2LBR]: SolvedState.F2LFR,
    };

    const mapSolvedState = (solvedState: number, mapping: Record<number, number>): number => {
      let mirroredState = solvedState;

      for (const originalState of Object.keys(mapping)) {
        const originalStateNum = Number(originalState);
        mirroredState &= ~originalStateNum;
      }

      for (const [originalState, mirroredStateValue] of Object.entries(mapping)) {
        const originalStateNum = Number(originalState);

        if (solvedState & originalStateNum) {
          mirroredState |= mirroredStateValue;
        }
      }

      return mirroredState;
    };

    let newEffectiveSolvedState = currentAlg.solved ?? SolvedState.FULL;
    if (mirrorAcrossM)
      newEffectiveSolvedState = mapSolvedState(newEffectiveSolvedState, MIRROR_ACROSS_M_MAPPING);
    if (mirrorAcrossS)
      newEffectiveSolvedState = mapSolvedState(newEffectiveSolvedState, MIRROR_ACROSS_S_MAPPING);
    if (randomYs > 0) {
      for (let i = 0; i < randomYs; ++i)
        newEffectiveSolvedState = mapSolvedState(newEffectiveSolvedState, Y_ROTATION_MAPPING);
    }

    return newEffectiveSolvedState;
  }, [currentAlg, randomYs, mirrorAcrossM, mirrorAcrossS]);

  const stickeringMask = useMemo(() => {
    if (!settings.useMaskings || !kpuzzle)
      return null;
    const setupPattern = kpuzzle.defaultPattern().applyAlg(setupAlg);
    return generateStickeringMask(setupPattern, effectiveSolvedState);
  }, [settings.useMaskings, kpuzzle, setupAlg, effectiveSolvedState]);

  /////////////////////////////////////////////////////////////////////////////
  // Handle cube move event
  /////////////////////////////////////////////////////////////////////////////
  const handleCubeMoveEvent = useCallback((event: GanCubeEvent) => {
    if (event.type !== "MOVE") return;

    const newMove = { move: event.move, timeOfMove: Date.now() };
    const newMoves = [...moves, newMove];
    playerRef.current.experimentalAddMove(event.move);

    const moveString = newMoves.map(move => move.move).join(' ');
    const currentPattern = kpuzzle.defaultPattern().applyAlg(setupAlg).applyAlg(moveString);
    const isSolved = isPatternSolved(currentPattern, effectiveSolvedState);

    if (!isSolved) {
      setMoves(prevMoves => ([...prevMoves, newMove]));
      return;
    }

    const newSolveStat: SolveStat = {
      name: currentAlg.name,
      timeOfSolve: new Date().toISOString(),
      moves: newMoves,
      executionTime: newMoves[newMoves.length-1].timeOfMove - newMoves[0].timeOfMove,
      recognitionTime: newMoves[0].timeOfMove - startTime,
      AUFs: randomUs,
      Ys: randomYs,
      mirroredOverM: mirrorAcrossM,
      mirroredOverS: mirrorAcrossS,
    };

    setStats(prevStats => {
      return {
        ...prevStats,
        [currentAlgSet.name]: [
          ...(prevStats[currentAlgSet.name] || []),
          newSolveStat
        ]
      };
    });

    let newCurrentAlg;
    if (settings.playlistMode === 'ordered') {
      const currentIndex = currentAlgSet.algs.findIndex(alg => alg.name === currentAlg.name);
      newCurrentAlg = currentAlgSet.algs[(currentIndex + 1) % currentAlgSet.algs.length];
    } else {
      const randomIndex = Math.floor(Math.random() * currentAlgSet.algs.length);
      newCurrentAlg = currentAlgSet.algs[randomIndex];
    }

    setCurrentAlg(newCurrentAlg);
    setPreorientationMoves(recomputePreorientationMoves(settings.fullColourNeutrality, settings.firstRotation, settings.randomRotations1));
    setRandomUs(recomputeRandomUs(settings.randomAUF));
    setRandomYs(recomputeRandomYs(settings.randomYs));
    setMirrorAcrossM(recomputeMirrorAcrossM(settings.mirrorAcrossM, settings.randomizeMirrorAcrossM));
    setMirrorAcrossS(recomputeMirrorAcrossS(settings.mirrorAcrossS, settings.randomizeMirrorAcrossS));
    setMoves([]);
    setStartTime(Date.now());
    playerRef.current.alg = '';
  }, [currentAlg, moves, setupAlg, startTime, currentAlgSet, effectiveSolvedState,
      kpuzzle, mirrorAcrossM, mirrorAcrossS, randomUs, randomYs, settings,
      setStats]);

  /////////////////////////////////////////////////////////////////////////////
  // useEffects
  /////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    const fetchPuzzle = async () => {
      try {
        const loadedKPuzzle: KPuzzle = await cube3x3x3.kpuzzle();
        setKpuzzle(loadedKPuzzle);
      } catch (error) {
        console.error("Error loading puzzle:", error);
      }
    };

    fetchPuzzle();
  }, []);

  useEffect(() => {
    if (conn) {
      const handleCubeEvent = async (event: GanCubeEvent) => {
        handleCubeMoveEvent(event);
      };
      const sub = conn.events$.subscribe(handleCubeEvent);

      return () => {
        sub.unsubscribe();
      };
    }
  }, [conn, handleCubeMoveEvent]);

  useEffect(() => {
    if (initialAlg === null) return;
    setCurrentAlg(initialAlg);
    setMoves([]);
    setStartTime(Date.now());
    playerRef.current.alg = '';
  }, [initialAlg]);

  useEffect(() => {
    setRandomUs(recomputeRandomUs(settings.randomAUF));
  }, [initialAlg, settings.randomAUF]);

  useEffect(() => {
    setRandomYs(recomputeRandomYs(settings.randomYs));
  }, [initialAlg, settings.randomYs]);

  useEffect(() => {
    setPreorientationMoves(recomputePreorientationMoves(settings.fullColourNeutrality, settings.firstRotation, settings.randomRotations1));
  }, [initialAlg, settings.fullColourNeutrality, settings.firstRotation, settings.randomRotations1]);

  useEffect(() => {
    setMirrorAcrossM(recomputeMirrorAcrossM(settings.mirrorAcrossM, settings.randomizeMirrorAcrossM));
  }, [initialAlg, settings.mirrorAcrossM, settings.randomizeMirrorAcrossM]);

  useEffect(() => {
    setMirrorAcrossS(recomputeMirrorAcrossS(settings.mirrorAcrossS, settings.randomizeMirrorAcrossS));
  }, [initialAlg, settings.mirrorAcrossS, settings.randomizeMirrorAcrossS]);

  useEffect(() => {
    if (!playerRef.current) return;
    playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(stickeringMask);
  }, [playerRef, stickeringMask]);

  /////////////////////////////////////////////////////////////////////////////
  // Helper functions
  /////////////////////////////////////////////////////////////////////////////
  const renderSolvedStateBadges = () => {
    if (!kpuzzle) return (<Group />);
    return (
      <Group gap="xs" mt="xs" justify="center">
        {Object.keys(SolvedState)
          .filter((key) => isNaN(Number(key)))
          .map((key) => {
            const solvedStateValue = SolvedState[key as keyof typeof SolvedState];
            const isActive = (solvedStateValue & effectiveSolvedState) === solvedStateValue;
            const moveString = moves.map((move) => (move.move)).join(' ');
            const currentPattern = kpuzzle.defaultPattern().applyAlg(setupAlg).applyAlg(moveString);
            const solved = isPatternSolved(currentPattern, SolvedState[key as keyof typeof SolvedState]);

            return (
              <Badge
                key={key}
                color={solved ? 'green' : 'gray'}
                bd={isActive ? '1px solid var(--mantine-primary-color-5)' : 'none'}
              >
                {key}
              </Badge>
            );
          })}
      </Group>
    );
  };

  /////////////////////////////////////////////////////////////////////////////
  // Rendering
  /////////////////////////////////////////////////////////////////////////////
  return (
    <Grid>
      <Grid.Col span={12}>
        <Card withBorder={true} padding="xs">
          <Card.Section withBorder={true}>
            <Center><Title mt="xs" mb="xs">Algorithm Set: {currentAlgSet.name}</Title></Center>
          </Card.Section>
          {renderSolvedStateBadges()}
        </Card>
      </Grid.Col>
      <Grid.Col span={4}>
        <Card withBorder={true} h="500">
          <Card.Section withBorder={true}>
            <Center>
              <Title order={2}>
                Case Name: {currentAlg.name}
              </Title>
            </Center>
          </Card.Section>
          <Card.Section withBorder={true}>
            <Center><Text>{currentAlg.alg.join(' ')}</Text></Center>
          </Card.Section>
          <Stack align="center" gap={0}>
            <TimerView key={startTime} startTime={startTime} />
            <twisty-player
              ref={playerRef}
              visualization="PG3D"
              control-panel="none"
              background="none"
              puzzle="3x3x3"
              tempo-scale="4"
              hint-facelets={settings.showHintFacelets ? "true" : "none"}
              experimental-setup-alg={setupAlg}
              style={{ width: "300px", height: "300px" }}
            />
          </Stack>
        </Card>
      </Grid.Col>
      <Grid.Col span={4}>
        <Stack h="500">
          <SummaryStatsView algSetName={currentAlgSet.name} />
          <TimesListView algSetName={currentAlgSet.name} />
        </Stack>
      </Grid.Col>
      <Grid.Col span={4}>
        <Stack h="500">
          <Skeleton visible={true} h="100%" />
          <Skeleton visible={true} h={200} />
        </Stack>
      </Grid.Col>
    </Grid>
  );
};

export default TrainerView;
