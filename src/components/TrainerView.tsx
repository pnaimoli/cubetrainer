import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { Grid, Card, Box, Text, Badge, Title, Group, Stack, Button, Tooltip } from '@mantine/core';
import { TbArrowLeft, TbArrowRight, TbRefresh, TbEye, TbEyeOff, TbAlertTriangle } from 'react-icons/tb';
import { useLocalStorage } from '@mantine/hooks';
import { KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

import { CTAlg } from '../util/CTAlg';
import { Settings, AlgSet, Alg, SolvedState, SolveStat, Move } from '../util/interfaces';
import { FACE_TO_D_ROTATION } from '../util/crossRotation';
import { isPatternSolved } from '../util/SolveChecker';
import { generateStickeringMask } from '../util/StickeringMask';
import { getNextAlg, ShuffleQueue } from '../util/playlist';
import CubeTimerPlayer, { CubeTimerPlayerHandle } from './CubeTimerPlayer';
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
  crossFaces: string[],
  randomRotations1: string | undefined
): { moves: Move[], crossFace: string } => {
  const faces = crossFaces?.length ? crossFaces : ['D'];
  const crossFace = faces[Math.floor(Math.random() * faces.length)];
  const moves: Move[] = [];

  const rotation = FACE_TO_D_ROTATION[crossFace];
  if (rotation) {
    moves.push({ move: rotation, timeOfMove: Date.now() });
  }

  if (randomRotations1) {
    const count = Math.floor(Math.random() * 4);
    if (count === 1) {
      moves.push({ move: randomRotations1, timeOfMove: Date.now() });
    } else if (count > 1) {
      moves.push({ move: `${randomRotations1}${count}`, timeOfMove: Date.now() });
    }
  }

  return { moves, crossFace };
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
  disableAlgSelection?: boolean;
}

///////////////////////////////////////////////////////////////////////////////
// SolvedStateBadges
///////////////////////////////////////////////////////////////////////////////
interface SolvedStateBadgesProps {
  kpuzzle: KPuzzle | null;
  setupAlg: string;
  effectiveSolvedState: number;
  movesRef: React.RefObject<Move[]>;
  crossFace?: string;
  /** Full display rotation (base + extra y). When provided, used instead of deriving from crossFace. */
  displayRotation?: string;
}

export interface SolvedStateBadgesHandle {
  notify: () => void;
}

export const SolvedStateBadges = React.forwardRef<SolvedStateBadgesHandle, SolvedStateBadgesProps>(
  ({ kpuzzle, setupAlg, effectiveSolvedState, movesRef, crossFace, displayRotation }, ref) => {
    const [, setMoveCount] = useState(0);

    React.useImperativeHandle(ref, () => ({
      notify: () => setMoveCount(c => c + 1),
    }));

    if (!kpuzzle) return <Group />;

    // Rotate the pattern so cross is on D and F2L slots align with the visual display.
    // displayRotation includes extra y rotations; fall back to base rotation from crossFace.
    const rotation = displayRotation ?? (crossFace && crossFace !== 'D' ? FACE_TO_D_ROTATION[crossFace] : '');

    return (
      <Group gap="xs" mt="xs">
        {Object.keys(SolvedState)
          .filter((key) => isNaN(Number(key)))
          .map((key) => {
            const solvedStateValue = SolvedState[key as keyof typeof SolvedState];
            const isActive = (solvedStateValue & effectiveSolvedState) === solvedStateValue;
            const moveString = (movesRef.current ?? []).map((move) => move.move).join(' ');
            let currentPattern = kpuzzle.defaultPattern().applyAlg(setupAlg).applyAlg(moveString);
            if (rotation) currentPattern = currentPattern.applyAlg(rotation);
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
  }
);

///////////////////////////////////////////////////////////////////////////////
// TrainerView
///////////////////////////////////////////////////////////////////////////////
const TrainerView: React.FC<TrainerViewProps> = ({ currentAlgSet, conn, settings, initialAlg, disableAlgSelection = false }) => {
  const [kpuzzle, setKpuzzle] = useState<KPuzzle | null>(null);
  const [currentAlg, setCurrentAlg] = useState<Alg>(() => initializeCurrentAlg(initialAlg, currentAlgSet, settings));
  const movesRef = useRef<Move[]>([]);
  const [caseKey, setCaseKey] = useState(0);
  const [preorientationResult, setPreorientationResult] = useState(() => recomputePreorientationMoves(settings.crossFaces, settings.randomRotations1));
  const preorientationMoves = preorientationResult.moves;
  const [randomPreUs, setRandomPreUs] = useState<number>(recomputeRandomUs(settings.randomPreAUF));
  const [randomUs, setRandomUs] = useState<number>(recomputeRandomUs(settings.randomAUF));
  const [randomYs, setRandomYs] = useState<number>(recomputeRandomYs(settings.randomYs));
  const [mirrorAcrossM, setMirrorAcrossM] = useState<boolean>(recomputeMirrorAcrossM(settings.mirrorAcrossM, settings.randomizeMirrorAcrossM));
  const [mirrorAcrossS, setMirrorAcrossS] = useState<boolean>(recomputeMirrorAcrossS(settings.mirrorAcrossS, settings.randomizeMirrorAcrossS));
  const [shuffleQueue, setShuffleQueue] = useState<ShuffleQueue>([]);
  const [historyOffset, setHistoryOffset] = useState<number>(0);
  const [caseHidden, setCaseHidden] = useState<boolean>(false);

  const [showSliceWarning, setShowSliceWarning] = useState(false);
  const [stats, setStats] = useLocalStorage<{ [key: string]: SolveStat[] }>({ key: 'stats', defaultValue: {}, getInitialValueInEffect: false });
  const cubeTimerRef = useRef<CubeTimerPlayerHandle>(null);
  const badgesRef = useRef<SolvedStateBadgesHandle>(null);
  const postSolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const solvedRef = useRef(false);
  const prevSettingsRef = useRef(settings);
  const prevInitialAlgRef = useRef(initialAlg);

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
  const displayedRandomPreUs = historyStat ? (historyStat.preAUFs ?? 0) : randomPreUs;
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

    let preMoves = '';
    if (displayedRandomPreUs === 1) {
      preMoves = 'U';
    } else if (displayedRandomPreUs === 2) {
      preMoves = 'U2';
    } else if (displayedRandomPreUs === 3) {
      preMoves = "U'";
    }

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

    return `${preorientationString} ${preMoves} ${inverseAlg} ${postMoves}`.replace(/\s+/g, ' ').trim();
  }, [displayedAlg, displayedPreorientation, displayedRandomPreUs, displayedRandomUs, displayedRandomYs, displayedMirrorAcrossM, displayedMirrorAcrossS]);

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
  // Handle cube move event
  /////////////////////////////////////////////////////////////////////////////
  const handleCubeMoveEvent = useCallback((event: GanCubeEvent) => {
    if (event.type !== "MOVE" || solvedRef.current) return;

    const OPPOSITE_FACES: Record<string, string> = { L:'R', R:'L', F:'B', B:'F', U:'D', D:'U' };

    const now = Date.now();
    const cubeTs = event.type === "MOVE" ? event.cubeTimestamp : null;

    // Detect slice move recovery: recovered move (null cube timestamp) on opposite face
    const prevMoves = movesRef.current;
    const moveFace = event.move.charAt(0);
    const isSliceRecovery = cubeTs === null
      && prevMoves.length > 0
      && OPPOSITE_FACES[prevMoves[prevMoves.length - 1].move.charAt(0)] === moveFace;

    const timeOfMove = isSliceRecovery ? prevMoves[prevMoves.length - 1].timeOfMove : now;

    if (movesRef.current.length === 0) {
      cubeTimerRef.current?.firstMove(timeOfMove);
      setShowSliceWarning(false);
    }

    const newMove = { move: event.move, timeOfMove };
    const newMoves = [...movesRef.current, newMove];
    movesRef.current = newMoves;
    cubeTimerRef.current?.addMove(event.move);

    const moveString = newMoves.map(move => move.move).join(' ');
    let isSolved = false;
    if (kpuzzle) {
      const currentPattern = kpuzzle.defaultPattern().applyAlg(setupAlg).applyAlg(moveString);
      isSolved = isPatternSolved(currentPattern, effectiveSolvedState);
    }

    if (!isSolved) {
      badgesRef.current?.notify();
      return;
    }

    solvedRef.current = true;

    const newSolveStat: SolveStat = {
      name: displayedAlg.name,
      timeOfSolve: new Date().toISOString(),
      moves: newMoves,
      executionTime: newMoves[newMoves.length-1].timeOfMove - newMoves[0].timeOfMove,
      recognitionTime: newMoves[0].timeOfMove - (cubeTimerRef.current?.getStartTime() ?? 0),
      preAUFs: displayedRandomPreUs,
      AUFs: displayedRandomUs,
      Ys: displayedRandomYs,
      mirroredOverM: displayedMirrorAcrossM,
      mirroredOverS: displayedMirrorAcrossS,
      preorientationMoves: displayedPreorientation.map(m => m.move),
    };

    if (isSliceRecovery) {
      setShowSliceWarning(true);
      cubeTimerRef.current?.stopAt(timeOfMove);
    } else {
      cubeTimerRef.current?.stop();
    }

    const advanceToNext = () => {
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
      setPreorientationResult(recomputePreorientationMoves(settings.crossFaces, settings.randomRotations1));
      setRandomPreUs(recomputeRandomUs(settings.randomPreAUF));
      setRandomUs(recomputeRandomUs(settings.randomAUF));
      setRandomYs(recomputeRandomYs(settings.randomYs));
      setMirrorAcrossM(recomputeMirrorAcrossM(settings.mirrorAcrossM, settings.randomizeMirrorAcrossM));
      setMirrorAcrossS(recomputeMirrorAcrossS(settings.mirrorAcrossS, settings.randomizeMirrorAcrossS));
      movesRef.current = [];
      solvedRef.current = false;

      setCaseKey(k => k + 1);
    };

    const delay = settings.postSolveDelay * 1000;
    if (delay > 0) {
      postSolveTimeoutRef.current = setTimeout(advanceToNext, delay);
    } else {
      advanceToNext();
    }
  }, [displayedAlg, setupAlg, currentAlgSet, effectiveSolvedState,
      kpuzzle, displayedMirrorAcrossM, displayedMirrorAcrossS, displayedRandomPreUs, displayedRandomUs,
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

    setCaseKey(k => k + 1);
  }, [initialAlg]);

  // Re-randomize only when the user actually changes a setting or navigates to a specific alg.
  // Comparing against previous values avoids re-rolling on mount/StrictMode re-mount.
  useEffect(() => {
    const prev = prevSettingsRef.current;
    const prevAlg = prevInitialAlgRef.current;
    prevSettingsRef.current = settings;
    prevInitialAlgRef.current = initialAlg;
    const algChanged = prevAlg !== initialAlg;
    if (algChanged || prev.randomPreAUF !== settings.randomPreAUF)
      setRandomPreUs(recomputeRandomUs(settings.randomPreAUF));
    if (algChanged || prev.randomAUF !== settings.randomAUF)
      setRandomUs(recomputeRandomUs(settings.randomAUF));
    if (algChanged || prev.randomYs !== settings.randomYs)
      setRandomYs(recomputeRandomYs(settings.randomYs));
    if (algChanged || (prev.crossFaces ?? []).join() !== (settings.crossFaces ?? []).join() || prev.randomRotations1 !== settings.randomRotations1)
      setPreorientationResult(recomputePreorientationMoves(settings.crossFaces, settings.randomRotations1));
    if (algChanged || prev.mirrorAcrossM !== settings.mirrorAcrossM || prev.randomizeMirrorAcrossM !== settings.randomizeMirrorAcrossM)
      setMirrorAcrossM(recomputeMirrorAcrossM(settings.mirrorAcrossM, settings.randomizeMirrorAcrossM));
    if (algChanged || prev.mirrorAcrossS !== settings.mirrorAcrossS || prev.randomizeMirrorAcrossS !== settings.randomizeMirrorAcrossS)
      setMirrorAcrossS(recomputeMirrorAcrossS(settings.mirrorAcrossS, settings.randomizeMirrorAcrossS));
  });

  useEffect(() => {
    return () => {
      if (postSolveTimeoutRef.current) clearTimeout(postSolveTimeoutRef.current);
    };
  }, []);

  /////////////////////////////////////////////////////////////////////////////
  // Control Handlers
  /////////////////////////////////////////////////////////////////////////////
  const handlePrev = () => {
    if (historyOffset >= currentStats.length) return;
    setHistoryOffset(prev => prev + 1);
    movesRef.current = [];
    solvedRef.current = false;

    setCaseKey(k => k + 1);
  };

  const handleRestart = () => {
    movesRef.current = [];
    solvedRef.current = false;

    setCaseKey(k => k + 1);
  };

  const handleNext = () => {
    if (historyOffset > 0) {
      setHistoryOffset(prev => prev - 1);
      movesRef.current = [];
      solvedRef.current = false;

      setCaseKey(k => k + 1);
      return;
    }
    const { alg: newCurrentAlg, shuffleQueue: newShuffleQueue } = getNextAlg(displayedAlg, currentAlgSet, settings, shuffleQueue);
    setCurrentAlg(newCurrentAlg);
    setShuffleQueue(newShuffleQueue);
    setPreorientationResult(recomputePreorientationMoves(settings.crossFaces, settings.randomRotations1));
    setRandomPreUs(recomputeRandomUs(settings.randomPreAUF));
    setRandomUs(recomputeRandomUs(settings.randomAUF));
    setRandomYs(recomputeRandomYs(settings.randomYs));
    setMirrorAcrossM(recomputeMirrorAcrossM(settings.mirrorAcrossM, settings.randomizeMirrorAcrossM));
    setMirrorAcrossS(recomputeMirrorAcrossS(settings.mirrorAcrossS, settings.randomizeMirrorAcrossS));
    movesRef.current = [];
    solvedRef.current = false;

    setCaseKey(k => k + 1);
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
          <SolvedStateBadges ref={badgesRef} kpuzzle={kpuzzle} setupAlg={setupAlg} effectiveSolvedState={effectiveSolvedState} movesRef={movesRef} />
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
          <CubeTimerPlayer
            ref={cubeTimerRef}
            setupAlg={setupAlg}
            showHintFacelets={settings.showHintFacelets}
            stickeringMask={stickeringMask}
            kpuzzle={kpuzzle}
            maskAfterFirstMove={settings.maskAfterFirstMove}
            caseKey={caseKey}
            timerAdornment={showSliceWarning ? (
              <Tooltip label="A BLE notification was dropped during a slice move. The time was adjusted to match the paired face turn." withArrow>
                <span style={{ position: 'absolute', top: 4, right: -18, lineHeight: 0 }}>
                  <TbAlertTriangle size={14} color="var(--mantine-color-gray-5)" />
                </span>
              </Tooltip>
            ) : undefined}
          />
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
            <Title order={2}>Settings</Title>
          </Card.Section>
          <Box pt="xs">
            <SettingsView disableAlgSelection={disableAlgSelection} />
          </Box>
        </Card>
      </Grid.Col>
    </Grid>
  );
};

export default TrainerView;
