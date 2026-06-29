import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { Grid, Card, Box, Text, Title, Group, Stack, Button, Checkbox, Tooltip, NumberInput, Spoiler } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { TbRefresh, TbArrowRight, TbAlertTriangle } from 'react-icons/tb';
import 'cubing/twisty';
import { TwistyPlayer } from 'cubing/twisty';
import { KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

import { Settings, SolvedState, Move } from '../util/interfaces';
import { isPatternSolved } from '../util/SolveChecker';
import { generateStickeringMask } from '../util/StickeringMask';
import { initCrossSolver, solveCross, generateRandomScramble, CrossSolution } from '../util/crossSolver';
import { requestFacelets, computeTransitionMoves, simplifyMoves, movesToHTM } from '../util/cubeState';
import ScrambleGuide from './ScrambleGuide';
import TimerView, { TimerViewHandle } from './TimerView';

interface CrossTrainerViewProps {
  conn: GanCubeConnection | null;
  settings: Settings;
}

interface CrossStat {
  scramble: string;
  userMoveCount: number;
  optimalMoveCount: number;
  timeMs: number;
  timestamp: string;
}

type Phase = 'scrambling' | 'solving' | 'solved';

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

const CrossTrainerView: React.FC<CrossTrainerViewProps> = ({ conn, settings }) => {
  const [kpuzzle, setKpuzzle] = useState<KPuzzle | null>(null);
  const [solverReady, setSolverReady] = useState(false);
  const [scramble, setScramble] = useState<string>('');
  const [optimalSolutions, setOptimalSolutions] = useState<CrossSolution[]>([]);
  const [phase, setPhase] = useState<Phase>('scrambling');
  const [transitionMoves, setTransitionMoves] = useState<string[]>([]);
  const [computingTransition, setComputingTransition] = useState(false);
  const movesRef = useRef<Move[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [result, setResult] = useState<{ userMoves: number; optimal: number; time: number } | null>(null);
  const [showSliceWarning, setShowSliceWarning] = useState(false);

  const [crossStats, setCrossStats] = useLocalStorage<CrossStat[]>({ key: 'crossStats', defaultValue: [] });
  const [showHintFacelets, setShowHintFacelets] = useState(settings.showHintFacelets);
  const [postSolveDelay, setPostSolveDelay] = useState(settings.postSolveDelay);

  const playerRef = useRef<TwistyPlayer>(null);
  const timerRef = useRef<TimerViewHandle>(null);
  const postSolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the current scramble for async operations
  const scrambleRef = useRef<string>('');

  // Setup alg for the 3D cube (the scramble itself)
  const setupAlg = useMemo(() => scramble, [scramble]);

  // Stickering mask for cross (show only cross-relevant stickers)
  const stickeringMask = useMemo(() => {
    if (!kpuzzle || !scramble) return null;
    const setupPattern = kpuzzle.defaultPattern().applyAlg(scramble);
    return generateStickeringMask(setupPattern, SolvedState.CROSS);
  }, [kpuzzle, scramble]);

  // Initialize puzzle and solver
  useEffect(() => {
    const init = async () => {
      const loadedKPuzzle = await cube3x3x3.kpuzzle();
      setKpuzzle(loadedKPuzzle as unknown as KPuzzle);
      initCrossSolver(loadedKPuzzle as unknown as KPuzzle);
      setSolverReady(true);
    };
    init();
  }, []);

  // Handle scramble complete - transition to solving
  const handleScrambleComplete = useCallback(() => {
    setPhase('solving');
    movesRef.current = [];
    setStartTime(Date.now());
  }, []);

  // Compute transition moves from current cube state to desired scramble state
  const computeTransition = useCallback(async (targetScramble: string) => {
    if (!kpuzzle || !conn) {
      // No cube connected - just show the raw scramble
      setTransitionMoves(targetScramble.split(/\s+/).filter(Boolean));
      return;
    }

    setComputingTransition(true);
    try {
      const facelets = await requestFacelets(conn);
      const rawMoves = await computeTransitionMoves(facelets, targetScramble, kpuzzle);
      const simplified = simplifyMoves(rawMoves);
      // Only update if this is still the current scramble
      if (scrambleRef.current === targetScramble) {
        if (simplified.length === 0) {
          // Already at desired state, go straight to solving
          handleScrambleComplete();
          return;
        }
        setTransitionMoves(simplified);
      }
    } catch (err) {
      // If facelets request fails, fall back to raw scramble
      console.warn('Failed to compute transition, using raw scramble:', err);
      if (scrambleRef.current === targetScramble) {
        setTransitionMoves(targetScramble.split(/\s+/).filter(Boolean));
      }
    } finally {
      setComputingTransition(false);
    }
  }, [kpuzzle, conn, handleScrambleComplete]);

  // Generate new scramble when solver is ready
  const generateNewScramble = useCallback(() => {
    if (!kpuzzle || !solverReady) return;
    const newScramble = generateRandomScramble();
    const pattern = kpuzzle.defaultPattern().applyAlg(newScramble);
    const solutions = solveCross(pattern);
    scrambleRef.current = newScramble;
    setScramble(newScramble);
    setOptimalSolutions(solutions);
    setPhase('scrambling');
    setResult(null);
    movesRef.current = [];
    setStartTime(Date.now());
    setShowSliceWarning(false);
    setTransitionMoves([]); // Clear while computing
    computeTransition(newScramble);
  }, [kpuzzle, solverReady, computeTransition]);

  useEffect(() => {
    if (solverReady) generateNewScramble();
  }, [solverReady, generateNewScramble]);

  // Apply stickering mask
  useEffect(() => {
    if (!playerRef.current) return;
    playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(stickeringMask);
  }, [stickeringMask]);

  // Reset player alg on new scramble
  useEffect(() => {
    if (movesRef.current.length === 0 && playerRef.current)
      playerRef.current.alg = '';
  }, [startTime]);

  // Handle cube moves during solving
  const handleCubeMoveEvent = useCallback((event: GanCubeEvent) => {
    if (event.type !== 'MOVE') return;
    if (phase !== 'solving') return;

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
      setShowSliceWarning(false);
    }

    const newMove = { move: event.move, timeOfMove };
    const newMoves = [...movesRef.current, newMove];
    movesRef.current = newMoves;
    playerRef.current?.experimentalAddMove(event.move);

    const moveString = newMoves.map(m => m.move).join(' ');
    if (kpuzzle) {
      const currentPattern = kpuzzle.defaultPattern().applyAlg(scramble).applyAlg(moveString);
      const isSolved = isPatternSolved(currentPattern, SolvedState.CROSS);

      if (isSolved) {
        const timeMs = newMoves[newMoves.length - 1].timeOfMove - newMoves[0].timeOfMove;
        const userMoves = movesToHTM(newMoves.map(m => m.move));
        const optimal = optimalSolutions.length > 0 ? optimalSolutions[0].moveCount : -1;

        setResult({ userMoves, optimal, time: timeMs });
        setPhase('solved');

        if (isSliceRecovery) {
          setShowSliceWarning(true);
          timerRef.current?.stopAt(timeOfMove);
        } else {
          timerRef.current?.stop();
        }

        const stat: CrossStat = {
          scramble,
          userMoveCount: userMoves,
          optimalMoveCount: optimal,
          timeMs,
          timestamp: new Date().toISOString(),
        };
        setCrossStats(prev => [...prev, stat]);
      }
    }
  }, [phase, kpuzzle, scramble, optimalSolutions, setCrossStats]);

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (postSolveTimeoutRef.current) clearTimeout(postSolveTimeoutRef.current);
    };
  }, []);

  const handleRetry = () => {
    // Re-scramble to same state - compute transition from current cube state
    setPhase('scrambling');
    setResult(null);
    movesRef.current = [];
    setStartTime(Date.now());
    setShowSliceWarning(false);
    setTransitionMoves([]);
    computeTransition(scramble);
  };

  const handleSkip = () => {
    generateNewScramble();
  };

  // Stats summary
  const recentStats = crossStats.slice(-50);
  const optimalCount = recentStats.filter(s => s.userMoveCount === s.optimalMoveCount).length;
  const avgMoves = recentStats.length > 0
    ? (recentStats.reduce((sum, s) => sum + s.userMoveCount, 0) / recentStats.length).toFixed(1)
    : '-';
  const avgOptimal = recentStats.length > 0
    ? (recentStats.reduce((sum, s) => sum + s.optimalMoveCount, 0) / recentStats.length).toFixed(1)
    : '-';

  return (
    <Grid>
      <Grid.Col span={12}>
        <Card withBorder padding="xs">
          <Card.Section withBorder px="xs">
            <Group justify="space-between">
              <Title mt="xs" mb="xs">Optimal Cross Trainer</Title>
              <Group>
                <Button variant="outline" size="xs" onClick={handleRetry} leftSection={<TbRefresh />}>
                  Retry
                </Button>
                <Button variant="outline" size="xs" onClick={handleSkip} leftSection={<TbArrowRight />}>
                  New Scramble
                </Button>
              </Group>
            </Group>
          </Card.Section>
        </Card>
      </Grid.Col>
      <Grid.Col span={4}>
        <Card withBorder>
          <Card.Section withBorder px="xs">
            <Group justify="space-between" align="center">
              <Spoiler maxHeight={0} showLabel="Solution" hideLabel="Solution" styles={{ control: { color: 'var(--mantine-color-dimmed)' } }}>
                <Stack gap={2} py="xs">
                  {optimalSolutions.slice(0, 5).map((sol, i) => (
                    <Text key={i} fz="sm" ff="monospace" c="dimmed">{sol.solution}</Text>
                  ))}
                  {optimalSolutions.length > 5 && (
                    <Text fz="xs" c="dimmed">+{optimalSolutions.length - 5} more</Text>
                  )}
                </Stack>
              </Spoiler>
              {optimalSolutions.length > 0 && (
                <Text fz="sm" c="dimmed">{optimalSolutions[0].moveCount} moves, {optimalSolutions.length} solution{optimalSolutions.length !== 1 ? 's' : ''}</Text>
              )}
            </Group>
          </Card.Section>

          <Stack align="center" gap={0}>
            <div style={{ position: 'relative' }}>
              {phase === 'scrambling' ? (
                <Text fz="48px" fw={600} ff="monospace" c="dimmed" py="xs">0.000</Text>
              ) : (
                <TimerView key={startTime} ref={timerRef} startTime={startTime} />
              )}
              {showSliceWarning && (
                <Tooltip label="A BLE notification was dropped during a slice move. The time was adjusted." withArrow>
                  <span style={{ position: 'absolute', top: 12, right: -18, lineHeight: 0 }}>
                    <TbAlertTriangle size={14} color="var(--mantine-color-gray-5)" />
                  </span>
                </Tooltip>
              )}
            </div>
            <CubePlayer playerRef={playerRef} setupAlg={setupAlg} showHintFacelets={showHintFacelets} />
          </Stack>

          <Card.Section px="xs" py="xs">
            <Group gap={4} wrap="wrap">
              <Text fz="sm" fw={700} c="dimmed">Scramble:</Text>
              <Text fz="sm" ff="monospace" c="dimmed">{scramble}</Text>
            </Group>
            {conn ? (
              computingTransition ? (
                <Group gap={4} wrap="wrap" mt={4}>
                  <Text fz="sm" fw={700} c="dimmed">Differential:</Text>
                  <Text fz="sm" c="dimmed">computing...</Text>
                </Group>
              ) : transitionMoves.length > 0 ? (
                <Group gap={4} wrap="wrap" mt={4} align="center">
                  <Text fz="sm" fw={700} c="dimmed">Differential:</Text>
                  <ScrambleGuide moves={transitionMoves} conn={conn} onComplete={handleScrambleComplete} />
                </Group>
              ) : (
                <Group gap={4} wrap="wrap" mt={4}>
                  <Text fz="sm" fw={700} c="dimmed">Differential:</Text>
                  <Text fz="sm" c="green" fw={700}>{phase === 'scrambling' ? 'already at target state' : 'done'}</Text>
                </Group>
              )
            ) : (
              <Group gap={4} wrap="wrap" mt={4}>
                <Text fz="sm" fw={700} c="dimmed">Differential:</Text>
                <Text fz="sm" c="yellow">connect cube to compute</Text>
              </Group>
            )}
          </Card.Section>

          {result && (
            <Card.Section px="xs" py="xs">
              {result.userMoves === result.optimal ? (
                <Text fz="lg" fw={700} c="green">Optimal! ({result.optimal} moves)</Text>
              ) : (
                <Text fz="lg" fw={700} c="yellow">
                  Solved in {result.userMoves} moves (optimal: {result.optimal})
                </Text>
              )}
            </Card.Section>
          )}
        </Card>
      </Grid.Col>
      <Grid.Col span={4}>
        <Stack>
          <Card withBorder>
            <Card.Section withBorder px="xs">
              <Title order={2} mt="xs" mb="xs">Stats (last 50)</Title>
            </Card.Section>
            <Stack gap="xs" p="xs">
              <Text fz="sm">Total solves: {recentStats.length}</Text>
              <Text fz="sm">Optimal solves: {optimalCount} ({recentStats.length > 0 ? ((optimalCount / recentStats.length) * 100).toFixed(0) : 0}%)</Text>
              <Text fz="sm">Avg moves: {avgMoves}</Text>
              <Text fz="sm">Avg optimal: {avgOptimal}</Text>
            </Stack>
          </Card>
          <Card withBorder>
            <Card.Section withBorder px="xs">
              <Title order={2} mt="xs" mb="xs">Recent Solves</Title>
            </Card.Section>
            <Box style={{ maxHeight: 'calc(100vh - 500px)', overflow: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.75rem', fontFamily: 'monospace', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                    <th style={{ textAlign: 'left', padding: '2px 6px' }}>#</th>
                    <th style={{ textAlign: 'right', padding: '2px 6px' }}>Moves</th>
                    <th style={{ textAlign: 'right', padding: '2px 6px' }}>Optimal</th>
                    <th style={{ textAlign: 'right', padding: '2px 6px' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {crossStats.slice().reverse().slice(0, 50).map((stat, i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'var(--mantine-color-dark-6)' : undefined }}>
                      <td style={{ padding: '2px 6px' }}>{crossStats.length - i}</td>
                      <td style={{ textAlign: 'right', padding: '2px 6px', color: stat.userMoveCount === stat.optimalMoveCount ? 'var(--mantine-color-green-5)' : undefined }}>
                        {stat.userMoveCount}
                      </td>
                      <td style={{ textAlign: 'right', padding: '2px 6px' }}>{stat.optimalMoveCount}</td>
                      <td style={{ textAlign: 'right', padding: '2px 6px' }}>{(stat.timeMs / 1000).toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Card>
        </Stack>
      </Grid.Col>
      <Grid.Col span={4}>
        <Card withBorder>
          <Card.Section withBorder px="xs">
            <Title order={2} mt="xs" mb="xs">Settings</Title>
          </Card.Section>
          <Stack gap="xs" p="xs">
            <Checkbox
              label="Show Hint Facelets"
              checked={showHintFacelets}
              onChange={(e) => setShowHintFacelets(e.currentTarget.checked)}
            />
            <Group gap="xs" align="center">
              <Text fz="sm">Post-Solve Delay (s):</Text>
              <NumberInput
                value={postSolveDelay}
                onChange={(value) => setPostSolveDelay(typeof value === 'number' ? value : 0)}
                min={0}
                max={10}
                step={0.1}
                decimalScale={1}
                hideControls
                maw="60px"
                size="xs"
              />
            </Group>
          </Stack>
        </Card>
      </Grid.Col>
    </Grid>
  );
};

export default CrossTrainerView;
