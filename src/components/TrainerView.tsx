import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { Grid, Card, Box, Text, Badge, Title, Group, Stack, Button } from '@mantine/core';
import { TbArrowLeft, TbArrowRight, TbRefresh, TbEye, TbEyeOff } from 'react-icons/tb';
import { useLocalStorage } from '@mantine/hooks';
import 'cubing/twisty';
import { TwistyPlayer } from 'cubing/twisty';
import { KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

import { CTAlg } from '../util/CTAlg';
import { Settings, AlgSet, Alg, SolvedState, CUBE_ROTATIONS, SolveStat, Move } from '../util/interfaces';
import { isPatternSolved } from '../util/SolveChecker';
import { generateStickeringMask } from '../util/StickeringMask';
import { getNextAlg, ShuffleQueue } from '../util/playlist';
import TimerView from './TimerView';
import SummaryStatsView from './SummaryStatsView';
import TimesListView from './TimesListView';
import SettingsView from './SettingsView';

const initializeCurrentAlg = (initialAlg: Alg | null, currentAlgSet: AlgSet, settings: Settings): Alg => {
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

interface TrainerViewProps {
  currentAlgSet: AlgSet;
  conn: GanCubeConnection | null;
  settings: Settings;
  initialAlg: Alg | null;
}

///////////////////////////////////////////////////////////////////////////////
// TrainerView
///////////////////////////////////////////////////////////////////////////////
const TrainerView: React.FC<TrainerViewProps> = ({ currentAlgSet, conn, settings, initialAlg }) => {
  const [kpuzzle, setKpuzzle] = useState<KPuzzle | null>(null);
  const [currentAlg, setCurrentAlg] = useState<Alg>(() => initializeCurrentAlg(initialAlg, currentAlgSet, settings));
  const [moves, setMoves] = useState<Move[]>([]);
  const movesRef = useRef<Move[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [preorientationMoves, setPreorientationMoves] = useState<Move[]>(recomputePreorientationMoves(settings.fullColourNeutrality, settings.firstRotation, settings.randomRotations1));
  const [randomUs, setRandomUs] = useState<number>(recomputeRandomUs(settings.randomAUF));
  const [randomYs, setRandomYs] = useState<number>(recomputeRandomYs(settings.randomYs));
  const [mirrorAcrossM, setMirrorAcrossM] = useState<boolean>(recomputeMirrorAcrossM(settings.mirrorAcrossM, settings.randomizeMirrorAcrossM));
  const [mirrorAcrossS, setMirrorAcrossS] = useState<boolean>(recomputeMirrorAcrossS(settings.mirrorAcrossS, settings.randomizeMirrorAcrossS));
  const [shuffleQueue, setShuffleQueue] = useState<ShuffleQueue>([]);
  const [historyOffset, setHistoryOffset] = useState<number>(0);
  const [caseHidden, setCaseHidden] = useState<boolean>(false);
  const [stats, setStats] = useLocalStorage<{ [key: string]: SolveStat[] }>({ key: 'stats', defaultValue: {} });
  const playerRef = useRef<TwistyPlayer>(null);

  const currentStats = stats[currentAlgSet.id] || [];
  const historyStat = historyOffset > 0
    ? currentStats[currentStats.length - historyOffset] ?? null
    : null;
  const displayedAlg = historyStat
    ? (currentAlgSet.algs.find(a => a.name === historyStat.name) ?? currentAlg)
    : currentAlg;
  const displayedPreorientation = historyStat
    ? (historyStat.preorientationMoves ?? []).map(m => ({ move: m, timeOfMove: 0 }))
    : preorientationMoves;
  const displayedRandomUs = historyStat ? historyStat.AUFs : randomUs;
  const displayedRandomYs = historyStat ? historyStat.Ys : randomYs;
  const displayedMirrorAcrossM = historyStat ? historyStat.mirroredOverM : mirrorAcrossM;
  const displayedMirrorAcrossS = historyStat ? historyStat.mirroredOverS : mirrorAcrossS;

  const setupAlg = useMemo(() => {
    // First compute what the inverse of our alg needs to be,
    // subject to potentially mirroring across a couple axes
    let algString = displayedAlg.alg.join(' ');

    if (displayedMirrorAcrossM)
      algString = (new CTAlg(algString)).mirror().toString();
    if (displayedMirrorAcrossS)
      algString = (new CTAlg(algString)).mirrorOverS().toString();

    const inverseAlg = (new CTAlg(algString)).invert().toString();

    const preorientationString = displayedPreorientation.map(move => move.move).join(' ');

    let postMoves = '';
    if (displayedRandomUs === 1) {
      postMoves += ' U';
    } else if (displayedRandomUs === 2) {
      postMoves += ` U2`;
    } else if (displayedRandomUs === 3) {
      postMoves += ` U'`;
    }

    if (displayedRandomYs === 1) {
      postMoves += ' y';
    } else if (displayedRandomYs === 2) {
      postMoves += ` y2`;
    } else if (displayedRandomYs === 3) {
      postMoves += ` y'`;
    }

    return `${preorientationString} ${inverseAlg} ${postMoves}`.replace(/\s+/g, ' ').trim();
  }, [displayedAlg, displayedPreorientation, displayedRandomUs, displayedRandomYs, displayedMirrorAcrossM, displayedMirrorAcrossS]);

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

    let newEffectiveSolvedState = displayedAlg.solved ?? SolvedState.FULL;
    if (displayedMirrorAcrossM)
      newEffectiveSolvedState = mapSolvedState(newEffectiveSolvedState, MIRROR_ACROSS_M_MAPPING);
    if (displayedMirrorAcrossS)
      newEffectiveSolvedState = mapSolvedState(newEffectiveSolvedState, MIRROR_ACROSS_S_MAPPING);
    if (displayedRandomYs > 0) {
      for (let i = 0; i < displayedRandomYs; ++i)
        newEffectiveSolvedState = mapSolvedState(newEffectiveSolvedState, Y_ROTATION_MAPPING);
    }

    return newEffectiveSolvedState;
  }, [displayedAlg, displayedRandomYs, displayedMirrorAcrossM, displayedMirrorAcrossS]);

  const stickeringMask = useMemo(() => {
    if (!settings.useMaskings || !kpuzzle)
      return null;
    const setupPattern = kpuzzle.defaultPattern().applyAlg(setupAlg);
    return generateStickeringMask(setupPattern, effectiveSolvedState);
  }, [settings.useMaskings, kpuzzle, setupAlg, effectiveSolvedState]);

  /////////////////////////////////////////////////////////////////////////////
  // KNOWN BUG: Toggling showHintFacelets or useMaskings while moves have been
  // made causes the cube to briefly show the wrong state (reverts to one move
  // behind) until the next move is made.
  //
  // Root cause: experimentalAddMove() updates the TwistyPlayer's alg
  // asynchronously (wraps in a Promise that chains multiple awaits). When a
  // setting change triggers the player to re-render its 3D scene, it reads the
  // alg which hasn't resolved yet, so it sees the stale (pre-move) value.
  //
  // Even player.alg = "string" is async under the hood - TwistyPropSource.set()
  // calls deriveFromPromiseOrValue() which does `await input` regardless of
  // whether input is a Promise or a plain value. So there is NO synchronous way
  // to set the alg on TwistyPlayer.
  //
  // Approaches tried (none worked):
  //  1. Re-applying moves via player.alg = moveString after setting change
  //     - Still async, same race condition
  //  2. Moving hint-facelets and experimental-setup-alg from JSX attributes to
  //     imperative useEffect setters to avoid React re-setting them on render
  //     - Didn't help; the bug isn't caused by React re-setting attributes
  //  3. Creating TwistyPlayer imperatively (new TwistyPlayer(), appendChild)
  //     instead of <twisty-player> JSX to fully remove it from React's lifecycle
  //     - Didn't help; the async alg is the issue, not React re-rendering
  //  4. Setting player.alg synchronously + triggering animation via
  //     experimentalModel.catchUpMove.set() and timestampRequest.set("end")
  //     - Bug returned; catchUpMove/timestampRequest trigger re-evaluation
  //  5. Same as #4 but with queueMicrotask() delay on catchUpMove
  //     - Didn't help
  //  6. requestAnimationFrame delay before re-applying alg
  //     - Didn't help
  //  7. Upgrading cubing.js from 0.49.0 to 0.63.3
  //     - Same async architecture, didn't help
  //
  // What DOES work (but loses animation):
  //  - Replacing experimentalAddMove with player.alg = moveString
  //    This resolves faster (single microtask vs multiple awaits) so the alg is
  //    settled by the time any setting change re-render occurs. But moves snap
  //    into place instead of animating.
  //
  // Related cubing.js issues:
  //  - https://github.com/cubing/cubing.js/issues/223 (framework sync getters)
  //  - https://github.com/cubing/cubing.js/issues/313 (React double-apply)
  //  - https://github.com/cubing/cubing.js/issues/371 (animation on alg write)
  /////////////////////////////////////////////////////////////////////////////

  /////////////////////////////////////////////////////////////////////////////
  // Handle cube move event
  /////////////////////////////////////////////////////////////////////////////
  const handleCubeMoveEvent = useCallback((event: GanCubeEvent) => {
    if (event.type !== "MOVE") return;

    const newMove = { move: event.move, timeOfMove: Date.now() };
    const newMoves = [...movesRef.current, newMove];
    movesRef.current = newMoves;
    playerRef.current?.experimentalAddMove(event.move);

    const moveString = newMoves.map(move => move.move).join(' ');
    let isSolved = false;
    if (kpuzzle) {
      const currentPattern = kpuzzle.defaultPattern().applyAlg(setupAlg).applyAlg(moveString);
      isSolved = isPatternSolved(currentPattern, effectiveSolvedState);
    }

    if (!isSolved) {
      setMoves(newMoves);
      return;
    }

    const newSolveStat: SolveStat = {
      name: displayedAlg.name,
      timeOfSolve: new Date().toISOString(),
      moves: newMoves,
      executionTime: newMoves[newMoves.length-1].timeOfMove - newMoves[0].timeOfMove,
      recognitionTime: newMoves[0].timeOfMove - startTime,
      AUFs: displayedRandomUs,
      Ys: displayedRandomYs,
      mirroredOverM: displayedMirrorAcrossM,
      mirroredOverS: displayedMirrorAcrossS,
      preorientationMoves: displayedPreorientation.map(m => m.move),
    };

    setStats(prevStats => {
      return {
        ...prevStats,
        [currentAlgSet.id]: [
          ...(prevStats[currentAlgSet.id] || []),
          newSolveStat
        ]
      };
    });

    const { alg: newCurrentAlg, shuffleQueue: newShuffleQueue } = getNextAlg(displayedAlg, currentAlgSet, settings, shuffleQueue);

    setCurrentAlg(newCurrentAlg);
    setShuffleQueue(newShuffleQueue);
    setHistoryOffset(0);
    setPreorientationMoves(recomputePreorientationMoves(settings.fullColourNeutrality, settings.firstRotation, settings.randomRotations1));
    setRandomUs(recomputeRandomUs(settings.randomAUF));
    setRandomYs(recomputeRandomYs(settings.randomYs));
    setMirrorAcrossM(recomputeMirrorAcrossM(settings.mirrorAcrossM, settings.randomizeMirrorAcrossM));
    setMirrorAcrossS(recomputeMirrorAcrossS(settings.mirrorAcrossS, settings.randomizeMirrorAcrossS));
    movesRef.current = [];
    setMoves([]);
    setStartTime(Date.now());
  }, [displayedAlg, setupAlg, startTime, currentAlgSet, effectiveSolvedState,
      kpuzzle, displayedMirrorAcrossM, displayedMirrorAcrossS, displayedRandomUs,
      displayedRandomYs, settings, shuffleQueue, displayedPreorientation,
      currentAlg, setStats]);

  /////////////////////////////////////////////////////////////////////////////
  // useEffects
  /////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    const fetchPuzzle = async () => {
      try {
        const loadedKPuzzle = await cube3x3x3.kpuzzle();
        setKpuzzle(loadedKPuzzle as unknown as KPuzzle);
      } catch (error) {
        console.error("Error loading puzzle:", error);
      }
    };

    fetchPuzzle();
  }, []);

  const handleCubeMoveEventRef = useRef(handleCubeMoveEvent);
  useEffect(() => {
    handleCubeMoveEventRef.current = handleCubeMoveEvent;
  }, [handleCubeMoveEvent]);

  useEffect(() => {
    if (conn) {
      const sub = conn.events$.subscribe((event) => {
        handleCubeMoveEventRef.current(event);
      });

      return () => {
        sub.unsubscribe();
      };
    }
  }, [conn]);

  useEffect(() => {
    if (initialAlg === null) return;
    setCurrentAlg(initialAlg);
    setMoves([]);
    setStartTime(Date.now());
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

  useEffect(() => {
    if (moves.length === 0 && playerRef.current)
      playerRef.current.alg = '';
  }, [playerRef, moves]);

  /////////////////////////////////////////////////////////////////////////////
  // Control Handlers
  /////////////////////////////////////////////////////////////////////////////
  const handlePrev = () => {
    if (historyOffset >= currentStats.length) return;
    setHistoryOffset(prev => prev + 1);
    movesRef.current = [];
    setMoves([]);
    setStartTime(Date.now());
  };

  const handleRestart = () => {
    movesRef.current = [];
    setMoves([]);
    setStartTime(Date.now());
  };

  const handleNext = () => {
    if (historyOffset > 0) {
      setHistoryOffset(prev => prev - 1);
      movesRef.current = [];
      setMoves([]);
      setStartTime(Date.now());
      return;
    }
    const { alg: newCurrentAlg, shuffleQueue: newShuffleQueue } = getNextAlg(displayedAlg, currentAlgSet, settings, shuffleQueue);
    setCurrentAlg(newCurrentAlg);
    setShuffleQueue(newShuffleQueue);
    setPreorientationMoves(recomputePreorientationMoves(settings.fullColourNeutrality, settings.firstRotation, settings.randomRotations1));
    setRandomUs(recomputeRandomUs(settings.randomAUF));
    setRandomYs(recomputeRandomYs(settings.randomYs));
    setMirrorAcrossM(recomputeMirrorAcrossM(settings.mirrorAcrossM, settings.randomizeMirrorAcrossM));
    setMirrorAcrossS(recomputeMirrorAcrossS(settings.mirrorAcrossS, settings.randomizeMirrorAcrossS));
    movesRef.current = [];
    setMoves([]);
    setStartTime(Date.now());
  };

  /////////////////////////////////////////////////////////////////////////////
  // Helper functions
  /////////////////////////////////////////////////////////////////////////////
  const renderSolvedStateBadges = () => {
    if (!kpuzzle) return (<Group />);
    return (
      <Group gap="xs" mt="xs">
        {Object.keys(SolvedState)
          .filter((key) => isNaN(Number(key)))
          .map((key) => {
            const solvedStateValue = SolvedState[key as keyof typeof SolvedState];
            const isActive = (solvedStateValue & effectiveSolvedState) === solvedStateValue;
            const moveString = moves.map((move) => (move.move)).join(' ');
            const currentPattern = kpuzzle?.defaultPattern().applyAlg(setupAlg).applyAlg(moveString);
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
          <Card.Section withBorder={true} px="xs">
            <Group justify="space-between">
              <Title mt="xs" mb="xs">Algorithm Set: {currentAlgSet.name}</Title>
              <Group>
                <Button disabled={historyOffset >= currentStats.length} variant="outline" size="xs" onClick={handlePrev} leftSection={<TbArrowLeft />}>
                  Previous
                </Button>
                <Button variant="outline" size="xs" onClick={handleRestart} leftSection={<TbRefresh />}>
                  Retry
                </Button>
                <Button variant="outline" size="xs" onClick={handleNext} leftSection={<TbArrowRight />}>
                  {historyOffset > 0 ? 'Forward' : 'Skip'}
                </Button>
              </Group>
            </Group>
          </Card.Section>
          {renderSolvedStateBadges()}
        </Card>
      </Grid.Col>
      <Grid.Col span={4}>
        <Card withBorder={true}>
          <Card.Section withBorder={true} px="xs">
              <Title order={2} style={{ cursor: 'pointer' }} onClick={() => setCaseHidden(h => !h)}>
                Case Name {caseHidden
                  ? <TbEyeOff style={{ verticalAlign: 'middle' }} />
                  : <TbEye style={{ verticalAlign: 'middle' }} />
                }: {caseHidden ? '???' : displayedAlg.name}
              </Title>
          </Card.Section>
          <Card.Section withBorder={true} px="xs">
            <Text>{displayedAlg.alg.join(' ')}</Text>
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
        <Stack>
          <SummaryStatsView algSetId={currentAlgSet.id} />
          <TimesListView algSetId={currentAlgSet.id} algSetName={currentAlgSet.name} maxHeight="calc(100vh - 360px)" />
        </Stack>
      </Grid.Col>
      <Grid.Col span={4}>
        <Card withBorder>
          <Card.Section withBorder px="xs">
            <Title order={2} mt="xs" mb="xs">Settings</Title>
          </Card.Section>
          <Box pt="xs">
            <SettingsView />
          </Box>
        </Card>
      </Grid.Col>
    </Grid>
  );
};

export default TrainerView;
