import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { Grid, Card, Box, Text, Title, Group, Stack, Button, Checkbox, Collapse, Divider } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { TbArrowRight, TbRefresh, TbEye, TbEyeOff } from 'react-icons/tb';
import 'cubing/twisty';
import { TwistyPlayer } from 'cubing/twisty';
import { KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

import { CTAlg } from '../util/CTAlg';
import { Settings, SolvedState, Move, CUBE_ROTATIONS } from '../util/interfaces';
import { isPatternSolved } from '../util/SolveChecker';
import { generateStickeringMask } from '../util/StickeringMask';
import { PuzzleStickering, PieceStickering, StickeringManager } from '../util/mask';
import { F2L_DB, OLL_DB } from '../util/algDatabase';
import SettingsView from './SettingsView';
import SolveTimer, { SolveTimerHandle } from './SolveTimer';
import { SolvedStateBadges, SolvedStateBadgesHandle } from './TrainerView';

interface OLLPredictionStat {
  f2lCase: string;
  ollCase: string;
  correct: boolean;
  timestamp: string;
}

const OLL_STATS_KEY = 'ollPredictionStats';

interface OLLPredictionViewProps {
  conn: GanCubeConnection | null;
  settings: Settings;
}

const CubePlayer = React.memo(({ playerRef, setupAlg, showHintFacelets }: {
  playerRef: React.RefObject<TwistyPlayer | null>;
  setupAlg: string;
  showHintFacelets: boolean;
}) => (
  <twisty-player
    ref={playerRef}
    visualization="PG3D"
    control-panel="none"
    background="none"
    puzzle="3x3x3"
    tempo-scale="4"
    hint-facelets={showHintFacelets ? "true" : "none"}
    experimental-setup-alg={setupAlg}
    style={{ width: "300px", height: "300px" }}
  />
));

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

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
      if (randomRotations === 1) {
        preorientationMoves.push({ move: randomRotations1, timeOfMove: Date.now() });
      } else if (randomRotations > 1) {
        preorientationMoves.push({ move: `${randomRotations1}${randomRotations}`, timeOfMove: Date.now() });
      }
    }
  }
  return preorientationMoves;
};

const recomputeMirrorAcrossM = (mirrorAcrossM: boolean, randomizeMirrorAcrossM: boolean): boolean => {
  if (!mirrorAcrossM) return false;
  if (randomizeMirrorAcrossM) return Math.random() < 0.5;
  return true;
};

const recomputeMirrorAcrossS = (mirrorAcrossS: boolean, randomizeMirrorAcrossS: boolean): boolean => {
  if (!mirrorAcrossS) return false;
  if (randomizeMirrorAcrossS) return Math.random() < 0.5;
  return true;
};

const ALGSET_NAME = 'OLL Prediction';
const F2L_CASES_KEY = 'ollPrediction_selectedF2L';
const OLL_CASES_KEY = 'ollPrediction_selectedOLL';

const OLLPredictionView: React.FC<OLLPredictionViewProps> = ({ conn, settings }) => {
  const [kpuzzle, setKpuzzle] = useState<KPuzzle | null>(null);
  const [selectedF2L, setSelectedF2L] = useLocalStorage<number[]>({
    key: F2L_CASES_KEY,
    defaultValue: F2L_DB.map((_, i) => i),
  });
  const [selectedOLL, setSelectedOLL] = useLocalStorage<number[]>({
    key: OLL_CASES_KEY,
    defaultValue: OLL_DB.map((_, i) => i),
  });
  const [showF2LSelector, setShowF2LSelector] = useState(false);
  const [showOLLSelector, setShowOLLSelector] = useState(false);

  // Current F2L case and OLL case
  const [currentF2LIndex, setCurrentF2LIndex] = useState<number>(() =>
    selectedF2L.length > 0 ? pickRandom(selectedF2L) : 0
  );
  const [currentOLLIndex, setCurrentOLLIndex] = useState<number>(() =>
    selectedOLL.length > 0 ? pickRandom(selectedOLL) : 0
  );

  const movesRef = useRef<Move[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [localSettings] = useLocalStorage<Settings>({ key: 'settings', defaultValue: settings });
  const [preorientationMoves, setPreorientationMoves] = useState<Move[]>(recomputePreorientationMoves(localSettings.fullColourNeutrality, localSettings.firstRotation, localSettings.randomRotations1));
  const [randomPreUs, setRandomPreUs] = useState<number>(recomputeRandomUs(localSettings.randomPreAUF));
  const [randomUs, setRandomUs] = useState<number>(recomputeRandomUs(localSettings.randomAUF));
  const [randomYs, setRandomYs] = useState<number>(recomputeRandomYs(localSettings.randomYs));
  const [mirrorAcrossM, setMirrorAcrossM] = useState<boolean>(recomputeMirrorAcrossM(localSettings.mirrorAcrossM, localSettings.randomizeMirrorAcrossM));
  const [mirrorAcrossS, setMirrorAcrossS] = useState<boolean>(recomputeMirrorAcrossS(localSettings.mirrorAcrossS, localSettings.randomizeMirrorAcrossS));
  const [caseHidden, setCaseHidden] = useState<boolean>(false);

  const [ollStats, setOllStats] = useLocalStorage<OLLPredictionStat[]>({ key: OLL_STATS_KEY, defaultValue: [] });

  const playerRef = useRef<TwistyPlayer>(null);
  const timerRef = useRef<SolveTimerHandle>(null);
  const badgesRef = useRef<SolvedStateBadgesHandle>(null);
  const postSolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentF2L = F2L_DB[currentF2LIndex];
  const currentOLL = OLL_DB[currentOLLIndex];

  // Setup alg: preorientation + preMoves + inverse(OLL_case) + inverse(F2L_case) + postMoves
  const setupAlg = useMemo(() => {
    let f2lAlgString = currentF2L.alg;
    let ollAlgString = currentOLL.alg;

    if (mirrorAcrossM) {
      f2lAlgString = (new CTAlg(f2lAlgString)).mirror().toString();
      ollAlgString = (new CTAlg(ollAlgString)).mirror().toString();
    }
    if (mirrorAcrossS) {
      f2lAlgString = (new CTAlg(f2lAlgString)).mirrorOverS().toString();
      ollAlgString = (new CTAlg(ollAlgString)).mirrorOverS().toString();
    }

    const inverseF2L = (new CTAlg(f2lAlgString)).invert().toString();
    const inverseOLL = (new CTAlg(ollAlgString)).invert().toString();

    const preorientationString = preorientationMoves.map(m => m.move).join(' ');

    let preMoves = '';
    if (randomPreUs === 1) preMoves = 'U';
    else if (randomPreUs === 2) preMoves = 'U2';
    else if (randomPreUs === 3) preMoves = "U'";

    let postMoves = '';
    if (randomUs === 1) postMoves += ' U';
    else if (randomUs === 2) postMoves += ' U2';
    else if (randomUs === 3) postMoves += " U'";

    if (randomYs === 1) postMoves += ' y';
    else if (randomYs === 2) postMoves += ' y2';
    else if (randomYs === 3) postMoves += " y'";

    return `${preorientationString} ${preMoves} ${inverseOLL} ${inverseF2L} ${postMoves}`.replace(/\s+/g, ' ').trim();
  }, [currentF2L, currentOLL, preorientationMoves, randomPreUs, randomUs, randomYs, mirrorAcrossM, mirrorAcrossS]);

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
      let result = solvedState;
      for (const originalState of Object.keys(mapping)) {
        result &= ~Number(originalState);
      }
      for (const [originalState, mappedValue] of Object.entries(mapping)) {
        if (solvedState & Number(originalState)) {
          result |= mappedValue;
        }
      }
      return result;
    };

    let state: number = SolvedState.OLL;
    if (mirrorAcrossM) state = mapSolvedState(state, MIRROR_ACROSS_M_MAPPING);
    if (mirrorAcrossS) state = mapSolvedState(state, MIRROR_ACROSS_S_MAPPING);
    if (randomYs > 0) {
      for (let i = 0; i < randomYs; ++i)
        state = mapSolvedState(state, Y_ROTATION_MAPPING);
    }
    return state;
  }, [randomYs, mirrorAcrossM, mirrorAcrossS]);

  const stickeringMask = useMemo(() => {
    if (!localSettings.useMaskings || !kpuzzle) return null;
    const setupPattern = kpuzzle.defaultPattern().applyAlg(setupAlg);
    return generateStickeringMask(setupPattern, effectiveSolvedState);
  }, [localSettings.useMaskings, kpuzzle, setupAlg, effectiveSolvedState]);

  // Load kpuzzle
  useEffect(() => {
    const fetchPuzzle = async () => {
      const loadedKPuzzle = await cube3x3x3.kpuzzle();
      setKpuzzle(loadedKPuzzle as unknown as KPuzzle);
    };
    fetchPuzzle();
  }, []);

  // Apply stickering mask
  useEffect(() => {
    if (!playerRef.current) return;
    playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(stickeringMask);
  }, [stickeringMask]);

  // Reset player alg on new case
  useEffect(() => {
    if (movesRef.current.length === 0 && playerRef.current) {
      playerRef.current.alg = '';
      playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(stickeringMask);
    }
  }, [startTime, stickeringMask]);

  // When maskAfterFirstMove is unchecked mid-solve, restore normal stickering
  useEffect(() => {
    if (!localSettings.maskAfterFirstMove && playerRef.current) {
      playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(stickeringMask);
    }
  }, [localSettings.maskAfterFirstMove]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (postSolveTimeoutRef.current) clearTimeout(postSolveTimeoutRef.current);
    };
  }, []);

  const advanceToNext = useCallback(() => {
    setCurrentF2LIndex(selectedF2L.length > 0 ? pickRandom(selectedF2L) : 0);
    setCurrentOLLIndex(selectedOLL.length > 0 ? pickRandom(selectedOLL) : 0);
    setPreorientationMoves(recomputePreorientationMoves(localSettings.fullColourNeutrality, localSettings.firstRotation, localSettings.randomRotations1));
    setRandomPreUs(recomputeRandomUs(localSettings.randomPreAUF));
    setRandomUs(recomputeRandomUs(localSettings.randomAUF));
    setRandomYs(recomputeRandomYs(localSettings.randomYs));
    setMirrorAcrossM(recomputeMirrorAcrossM(localSettings.mirrorAcrossM, localSettings.randomizeMirrorAcrossM));
    setMirrorAcrossS(recomputeMirrorAcrossS(localSettings.mirrorAcrossS, localSettings.randomizeMirrorAcrossS));
    movesRef.current = [];
    setStartTime(Date.now());
  }, [selectedF2L, selectedOLL, localSettings]);

  const recordStat = useCallback((correct: boolean) => {
    setOllStats(prev => [...prev, {
      f2lCase: currentF2L.name,
      ollCase: currentOLL.name,
      correct,
      timestamp: new Date().toISOString(),
    }]);
  }, [currentF2L, currentOLL, setOllStats]);

  const handleCubeMoveEvent = useCallback((event: GanCubeEvent) => {
    if (event.type !== 'MOVE') return;

    const OPPOSITE_FACES: Record<string, string> = { L:'R', R:'L', F:'B', B:'F', U:'D', D:'U' };
    const now = Date.now();
    const cubeTs = event.cubeTimestamp ?? null;

    const prevMoves = movesRef.current;
    const moveFace = event.move.charAt(0);
    const isSliceRecovery = cubeTs === null
      && prevMoves.length > 0
      && OPPOSITE_FACES[prevMoves[prevMoves.length - 1].move.charAt(0)] === moveFace;

    const timeOfMove = isSliceRecovery ? prevMoves[prevMoves.length - 1].timeOfMove : now;

    if (movesRef.current.length === 0) {
      timerRef.current?.firstMove(timeOfMove);
      // Mask after first move
      if (localSettings.maskAfterFirstMove && kpuzzle && playerRef.current) {
        const blindMask = new PuzzleStickering(kpuzzle);
        const mgr = new StickeringManager(kpuzzle);
        blindMask.set(mgr.all(), PieceStickering.Ignored);
        playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(blindMask.toStickeringMask());
      }
    }

    const newMove = { move: event.move, timeOfMove };
    const newMoves = [...movesRef.current, newMove];
    movesRef.current = newMoves;
    playerRef.current?.experimentalAddMove(event.move);

    const moveString = newMoves.map(m => m.move).join(' ');
    let isSolved = false;
    if (kpuzzle) {
      const currentPattern = kpuzzle.defaultPattern().applyAlg(setupAlg).applyAlg(moveString);
      isSolved = isPatternSolved(currentPattern, effectiveSolvedState);
    }

    if (!isSolved) {
      badgesRef.current?.notify();
      return;
    }

    timerRef.current?.stopAt(timeOfMove);
    recordStat(true);

    const delay = localSettings.postSolveDelay * 1000;
    if (delay > 0) {
      postSolveTimeoutRef.current = setTimeout(advanceToNext, delay);
    } else {
      advanceToNext();
    }
  }, [setupAlg, effectiveSolvedState, kpuzzle, localSettings, recordStat, advanceToNext]);

  const handleCubeMoveEventRef = useRef(handleCubeMoveEvent);
  useEffect(() => {
    handleCubeMoveEventRef.current = handleCubeMoveEvent;
  }, [handleCubeMoveEvent]);

  useEffect(() => {
    if (conn) {
      const sub = conn.events$.subscribe((event) => {
        handleCubeMoveEventRef.current(event);
      });
      return () => sub.unsubscribe();
    }
  }, [conn]);

  // Settings effects
  useEffect(() => {
    setRandomPreUs(recomputeRandomUs(localSettings.randomPreAUF));
  }, [localSettings.randomPreAUF]);

  useEffect(() => {
    setRandomUs(recomputeRandomUs(localSettings.randomAUF));
  }, [localSettings.randomAUF]);

  useEffect(() => {
    setRandomYs(recomputeRandomYs(localSettings.randomYs));
  }, [localSettings.randomYs]);

  useEffect(() => {
    setPreorientationMoves(recomputePreorientationMoves(localSettings.fullColourNeutrality, localSettings.firstRotation, localSettings.randomRotations1));
  }, [localSettings.fullColourNeutrality, localSettings.firstRotation, localSettings.randomRotations1]);

  useEffect(() => {
    setMirrorAcrossM(recomputeMirrorAcrossM(localSettings.mirrorAcrossM, localSettings.randomizeMirrorAcrossM));
  }, [localSettings.mirrorAcrossM, localSettings.randomizeMirrorAcrossM]);

  useEffect(() => {
    setMirrorAcrossS(recomputeMirrorAcrossS(localSettings.mirrorAcrossS, localSettings.randomizeMirrorAcrossS));
  }, [localSettings.mirrorAcrossS, localSettings.randomizeMirrorAcrossS]);

  const handleRestart = () => {
    if (movesRef.current.length > 0) recordStat(false);
    movesRef.current = [];
    setStartTime(Date.now());
  };

  const handleNext = () => {
    if (movesRef.current.length > 0) recordStat(false);
    advanceToNext();
  };

  const toggleF2LCase = (index: number) => {
    setSelectedF2L(prev => {
      if (prev.includes(index)) {
        if (prev.length <= 1) return prev;
        return prev.filter(i => i !== index);
      }
      return [...prev, index];
    });
  };

  const toggleOLLCase = (index: number) => {
    setSelectedOLL(prev => {
      if (prev.includes(index)) {
        if (prev.length <= 1) return prev;
        return prev.filter(i => i !== index);
      }
      return [...prev, index];
    });
  };

  return (
    <Grid>
      <Grid.Col span={12}>
        <Card withBorder padding="xs">
          <Card.Section withBorder px="xs">
            <Group justify="space-between">
              <Title mt="xs" mb="xs">{ALGSET_NAME}</Title>
              <Group>
                <Button variant="outline" size="xs" onClick={handleRestart} leftSection={<TbRefresh />}>
                  Retry
                </Button>
                <Button variant="outline" size="xs" onClick={handleNext} leftSection={<TbArrowRight />}>
                  Skip
                </Button>
              </Group>
            </Group>
          </Card.Section>
          <SolvedStateBadges ref={badgesRef} kpuzzle={kpuzzle} setupAlg={setupAlg} effectiveSolvedState={effectiveSolvedState} movesRef={movesRef} />
        </Card>
      </Grid.Col>
      <Grid.Col span={4}>
        <Card withBorder>
          <Card.Section withBorder px="xs">
            <Title order={2} style={{ cursor: 'pointer' }} onClick={() => setCaseHidden(h => !h)}>
              Case {caseHidden
                ? <TbEyeOff style={{ verticalAlign: 'middle' }} />
                : <TbEye style={{ verticalAlign: 'middle' }} />
              }: {caseHidden ? '???' : `F2L-${currentF2L.name} + OLL-${currentOLL.name}`}
            </Title>
          </Card.Section>
          <Stack align="center" gap={0} mt="xs">
            <SolveTimer key={startTime} ref={timerRef} />
            <CubePlayer playerRef={playerRef} setupAlg={setupAlg} showHintFacelets={localSettings.showHintFacelets} />
          </Stack>
        </Card>
      </Grid.Col>
      <Grid.Col span={4}>
        <Card withBorder>
          <Card.Section withBorder px="xs">
            <Title order={2} mt="xs" mb="xs">Results</Title>
          </Card.Section>
          <Stack gap="xs" p="xs">
            {(() => {
              const correct = ollStats.filter(s => s.correct).length;
              const wrong = ollStats.filter(s => !s.correct).length;
              const total = ollStats.length;
              const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
              return (
                <>
                  <Group justify="space-between">
                    <Text fz="sm" c="green" fw={700}>Correct: {correct}</Text>
                    <Text fz="sm" c="red" fw={700}>Wrong: {wrong}</Text>
                    <Text fz="sm" fw={700}>{pct}%</Text>
                  </Group>
                  <Divider />
                  <Stack gap={2} style={{ maxHeight: 'calc(100vh - 360px)', overflow: 'auto' }}>
                    {[...ollStats].reverse().slice(0, 50).map((stat, i) => (
                      <Group key={i} justify="space-between" gap="xs">
                        <Text fz="xs" ff="monospace">F2L-{stat.f2lCase} + OLL-{stat.ollCase}</Text>
                        <Text fz="xs" fw={700} c={stat.correct ? 'green' : 'red'}>
                          {stat.correct ? 'OK' : 'X'}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </>
              );
            })()}
            {ollStats.length > 0 && (
              <Button size="xs" variant="subtle" color="red" onClick={() => setOllStats([])}>
                Clear Stats
              </Button>
            )}
          </Stack>
        </Card>
      </Grid.Col>
      <Grid.Col span={4}>
        <Card withBorder>
          <Card.Section withBorder px="xs">
            <Title order={2} mt="xs" mb="xs">Settings</Title>
          </Card.Section>
          <Box pt="xs">
            <SettingsView disableAlgSelection />
          </Box>
          <Stack gap="xs" p="xs">
            <Divider label="F2L Case Selection" />
            <Group gap="xs">
              <Button size="xs" variant="subtle" onClick={() => setSelectedF2L(F2L_DB.map((_, i) => i))}>All</Button>
              <Button size="xs" variant="subtle" onClick={() => setSelectedF2L([0])}>None</Button>
              <Button size="xs" variant="subtle" onClick={() => setShowF2LSelector(s => !s)}>
                {showF2LSelector ? 'Hide' : 'Show'} ({selectedF2L.length}/{F2L_DB.length})
              </Button>
            </Group>
            <Collapse in={showF2LSelector}>
              <Stack gap={2}>
                {F2L_DB.map((entry, i) => (
                  <Checkbox
                    key={i}
                    label={`${entry.name}: ${entry.alg}`}
                    checked={selectedF2L.includes(i)}
                    onChange={() => toggleF2LCase(i)}
                    size="xs"
                    styles={{ label: { fontFamily: 'monospace', fontSize: '0.7rem' } }}
                  />
                ))}
              </Stack>
            </Collapse>

            <Divider label="OLL Case Selection" />
            <Group gap="xs">
              <Button size="xs" variant="subtle" onClick={() => setSelectedOLL(OLL_DB.map((_, i) => i))}>All</Button>
              <Button size="xs" variant="subtle" onClick={() => setSelectedOLL([0])}>None</Button>
              <Button size="xs" variant="subtle" onClick={() => setShowOLLSelector(s => !s)}>
                {showOLLSelector ? 'Hide' : 'Show'} ({selectedOLL.length}/{OLL_DB.length})
              </Button>
            </Group>
            <Collapse in={showOLLSelector}>
              <Stack gap={2}>
                {OLL_DB.map((entry, i) => (
                  <Checkbox
                    key={i}
                    label={`${entry.name}: ${entry.alg}`}
                    checked={selectedOLL.includes(i)}
                    onChange={() => toggleOLLCase(i)}
                    size="xs"
                    styles={{ label: { fontFamily: 'monospace', fontSize: '0.7rem' } }}
                  />
                ))}
              </Stack>
            </Collapse>
          </Stack>
        </Card>
      </Grid.Col>
    </Grid>
  );
};

export default OLLPredictionView;
