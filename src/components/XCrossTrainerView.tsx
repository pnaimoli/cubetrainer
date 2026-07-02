import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { Grid, Card, Box, Text, Title, Group, Stack, Button, Checkbox, Tooltip, Divider, Menu, ActionIcon, rem, Modal, Chip, Skeleton, Select, Slider } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { DataTable, DataTableColumn } from 'mantine-datatable';
import { mkConfig, generateCsv, download } from 'export-to-csv';
import { TbRefresh, TbArrowRight, TbAlertTriangle, TbDots, TbTrash, TbInfoCircle, TbDownload, TbChevronDown, TbChevronUp } from 'react-icons/tb';
import { KPuzzle, KPattern } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

import { Settings, SolvedState, Move } from '../util/interfaces';
import { isPatternSolved } from '../util/SolveChecker';
import { generateStickeringMask } from '../util/StickeringMask';
import { randomScrambleForEvent } from 'cubing/scramble';
import { initCrossSolver, solveCross } from '../util/crossSolver';
import { initXCrossSolver, solveXCross, XCrossSolution } from '../util/xcrossSolver';
import { movesToHTM, simplifyMoves } from '../util/cubeState';
import { rankXCrossSolutions, RankedSolution } from '../util/crossSolutionRanker';
import { FACE_TO_D_ROTATION, translateMove, translateSlot, randomRotationString } from '../util/crossRotation';
import FaceColorPicker from './FaceColorPicker';
import DifferentialScramble from './DifferentialScramble';
import CubeTimerPlayer, { CubeTimerPlayerHandle } from './CubeTimerPlayer';
import { SolvedStateBadges, SolvedStateBadgesHandle } from './TrainerView';

// Map from slot name to the SolvedState flag for that F2L pair
const SLOT_SOLVED_STATE: Record<string, SolvedState> = {
  FR: SolvedState.F2LFR,
  FL: SolvedState.F2LFL,
  BL: SolvedState.F2LBL,
  BR: SolvedState.F2LBR,
};


interface XCrossTrainerViewProps {
  conn: GanCubeConnection | null;
  settings: Settings;
}

interface XCrossStat {
  scramble: string;
  slot: string;
  userMoveCount: number;
  optimalMoveCount: number;
  inspectionMs: number;
  executionMs: number;
  timestamp: string;
}

type Phase = 'scrambling' | 'solving' | 'solved';

const XCrossTrainerView: React.FC<XCrossTrainerViewProps> = ({ conn, settings }) => {
  const [kpuzzle, setKpuzzle] = useState<KPuzzle | null>(null);
  const [solverReady, setSolverReady] = useState(false);
  const [scramble, setScramble] = useState<string>('');
  const [optimalSolutions, setOptimalSolutions] = useState<XCrossSolution[]>([]);
  const [crossOptimal, setCrossOptimal] = useState<number>(-1);
  const [phase, setPhase] = useState<Phase>('scrambling');
  const [targetSlot, setTargetSlot] = useState<string>('');
  const [diffKey, setDiffKey] = useState(0);
  const movesRef = useRef<Move[]>([]);
  const [caseKey, setCaseKey] = useState(0);
  const [result, setResult] = useState<{ userMoves: number; optimal: number; inspectionMs: number; executionMs: number } | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [showSliceWarning, setShowSliceWarning] = useState(false);
  const isRetryRef = useRef(false);
  const solvedRef = useRef(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [solving, setSolving] = useState(false);

  const [xcrossStats, setXcrossStats] = useLocalStorage<XCrossStat[]>({ key: 'xcrossStats', defaultValue: [], getInitialValueInEffect: false });
  const [showHintFacelets, setShowHintFacelets] = useState(settings.showHintFacelets);
  const [useMaskings, setUseMaskings] = useState(settings.useMaskings);
  const [maskAfterFirstMove, setMaskAfterFirstMove] = useState(settings.maskAfterFirstMove);
  const [crossColors, setCrossColors] = useLocalStorage<string[]>({ key: 'xcrossColors', defaultValue: ['D'], getInitialValueInEffect: false });
  const crossColorsRef = useRef(crossColors);
  crossColorsRef.current = crossColors;
  const [crossFace, setCrossFace] = useState('D');
  const [randomRotationAxis, setRandomRotationAxis] = useLocalStorage<string>({ key: 'xcrossRandomRotation', defaultValue: '', getInitialValueInEffect: false });
  const randomRotationAxisRef = useRef(randomRotationAxis);
  randomRotationAxisRef.current = randomRotationAxis;
  const [extraRotation, setExtraRotation] = useState('');

  // Slot selection
  const [selectedSlots, setSelectedSlots] = useLocalStorage<string[]>({ key: 'xcrossSlots', defaultValue: ['FR', 'FL', 'BL', 'BR'], getInitialValueInEffect: false });

  // Exact move count filter (0 = any)
  const [xcrossMoveCount, setXcrossMoveCount] = useLocalStorage<number>({ key: 'xcrossMoveCount', defaultValue: 0, getInitialValueInEffect: false });

  // Minimum extra moves beyond cross optimal (0 = just must be strictly harder)
  const [minExtraMoves, setMinExtraMoves] = useLocalStorage<number>({ key: 'xcrossMinExtra', defaultValue: 0, getInitialValueInEffect: false });

  // Clear old stats that lack required fields
  useEffect(() => {
    if (xcrossStats.length > 0 && !('executionMs' in xcrossStats[0])) {
      setXcrossStats([]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cubeTimerRef = useRef<CubeTimerPlayerHandle>(null);
  const badgesRef = useRef<SolvedStateBadgesHandle>(null);
  const scrambleRef = useRef<string>('');

  // Display rotation: base rotation (cross on D) + random y rotation for training
  const displayRotation = [FACE_TO_D_ROTATION[crossFace], extraRotation].filter(Boolean).join(' ');
  const setupAlg = useMemo(() =>
    displayRotation ? `${scramble} ${displayRotation}` : scramble,
    [scramble, displayRotation],
  );

  // Map visual slot names <-> solver slot names based on display rotation.
  // Chip labels are visual (what the user sees on the rotated display).
  // The solver uses slot names relative to the cross face.
  const visualToSolverSlot = useMemo(() => {
    const ALL_SLOTS = ['FR', 'FL', 'BL', 'BR'];
    const map: Record<string, string> = {};
    for (const solverSlot of ALL_SLOTS) {
      const visualSlot = translateSlot(solverSlot, crossFace, displayRotation);
      map[visualSlot] = solverSlot;
    }
    return map;
  }, [crossFace, displayRotation]);

  const solverToVisualSlot = useMemo(() => {
    const inv: Record<string, string> = {};
    for (const [visual, solver] of Object.entries(visualToSolverSlot)) {
      inv[solver] = visual;
    }
    return inv;
  }, [visualToSolverSlot]);

  // Map solver slot to D-frame slot for solved checking.
  // After applying FACE_TO_D_ROTATION, the solver's slots land at different D-frame positions.
  const solverSlotToDFrame = useMemo(() => {
    const baseRotation = FACE_TO_D_ROTATION[crossFace] ?? '';
    const map: Record<string, string> = {};
    for (const slot of ['FR', 'FL', 'BL', 'BR']) {
      map[slot] = translateSlot(slot, crossFace, baseRotation);
    }
    return map;
  }, [crossFace]);

  // Get the D-frame SolvedState flag for a solver slot
  const getDFrameSlotState = useCallback((solverSlot: string): SolvedState => {
    const dFrameSlot = solverSlotToDFrame[solverSlot] ?? solverSlot;
    return SLOT_SOLVED_STATE[dFrameSlot] ?? 0;
  }, [solverSlotToDFrame]);

  // Stickering mask: highlight cross edges + target F2L pair
  const stickeringMask = useMemo(() => {
    if (!useMaskings || !kpuzzle || !scramble || !targetSlot) return null;
    const setupPattern = kpuzzle.defaultPattern().applyAlg(scramble);
    const slotState = getDFrameSlotState(targetSlot);
    return generateStickeringMask(setupPattern, SolvedState.CROSS | slotState, crossFace);
  }, [useMaskings, kpuzzle, scramble, crossFace, targetSlot, getDFrameSlotState]);

  // Initialize puzzle and solver
  useEffect(() => {
    const init = async () => {
      const loadedKPuzzle = await cube3x3x3.kpuzzle();
      setKpuzzle(loadedKPuzzle as unknown as KPuzzle);
      initCrossSolver(loadedKPuzzle as unknown as KPuzzle);
      initXCrossSolver(loadedKPuzzle as unknown as KPuzzle);
      setSolverReady(true);
    };
    init();
  }, []);

  const handleScrambleComplete = useCallback(() => {
    setPhase('solving');
    movesRef.current = [];
    cubeTimerRef.current?.start();
  }, []);

  const moveCountRef = useRef(xcrossMoveCount);
  moveCountRef.current = xcrossMoveCount;

  const minExtraRef = useRef(minExtraMoves);
  minExtraRef.current = minExtraMoves;

  const selectedSlotsRef = useRef(selectedSlots);
  selectedSlotsRef.current = selectedSlots;

  const generateNewScramble = useCallback(async () => {
    if (!kpuzzle || !solverReady) return;

    const colors = crossColorsRef.current;
    const face = colors[Math.floor(Math.random() * colors.length)];
    const targetMoves = moveCountRef.current;
    const extra = randomRotationString(randomRotationAxisRef.current);
    const rotation = [FACE_TO_D_ROTATION[face], extra].filter(Boolean).join(' ');

    // Translate user's visual slot picks to solver slot names for this rotation
    const visualSlots = selectedSlotsRef.current.length > 0 ? selectedSlotsRef.current : ['FR', 'FL', 'BL', 'BR'];
    const allSolverSlots = ['FR', 'FL', 'BL', 'BR'];
    const solverSlots = visualSlots.map(vs => {
      for (const ss of allSolverSlots) {
        if (translateSlot(ss, face, rotation) === vs) return ss;
      }
      return vs;
    });

    setCrossFace(face);
    setExtraRotation(extra);
    isRetryRef.current = false;
    solvedRef.current = false;
    setPhase('scrambling');
    setResult(null);
    movesRef.current = [];
    setMoveCount(0);
    setCaseKey(k => k + 1);
    setShowSliceWarning(false);
    setDiffKey(k => k + 1);
    setSolving(true);
    setOptimalSolutions([]);
    setTargetSlot('');

    // Solve cross and check that xcross is sufficiently harder.
    // Returns cross optimal if valid, null if xcross is too easy.
    const minExtra = minExtraRef.current;
    const getCrossOptimalIfValid = (pattern: KPattern, xcrossSolutions: XCrossSolution[]): number | null => {
      if (xcrossSolutions.length === 0) return null;
      const crossSolutions = solveCross(pattern, face);
      const crossOpt = crossSolutions.length > 0 ? crossSolutions[0].moveCount : 0;
      const xcrossOpt = xcrossSolutions[0].moveCount;
      // Must be strictly harder, and at least minExtra moves beyond cross
      return xcrossOpt > crossOpt && (xcrossOpt - crossOpt) >= Math.max(1, minExtra) ? crossOpt : null;
    };

    // Generate a scramble with xcross solutions in the move range.
    // Rejects scrambles where xcross optimal <= cross optimal (free F2L pair).
    const findValidScramble = async () => {
      for (let outerAttempt = 0; outerAttempt < 20; outerAttempt++) {
        const scrambleAlg = await randomScrambleForEvent('333');
        const baseScramble = scrambleAlg.toString();
        const basePattern = kpuzzle.defaultPattern().applyAlg(baseScramble);
        const solutions = solveXCross(basePattern, face, solverSlots);

        if (solutions.length === 0) continue;
        const crossOpt = getCrossOptimalIfValid(basePattern, solutions);
        if (crossOpt === null) continue;

        // No filter: use as-is
        if (targetMoves === 0) {
          return { moves: baseScramble, solutions, crossOptimal: crossOpt };
        }

        // Check if any solution already matches
        if (solutions.some(s => s.moveCount === targetMoves)) {
          return { moves: baseScramble, solutions, crossOptimal: crossOpt };
        }

        // Solution too long: shorten by appending prefix moves to the scramble
        const best = solutions[0];
        if (best.moveCount > targetMoves) {
          const solMoves = best.solution.split(/\s+/).filter(Boolean);
          const prefixMoves = solMoves.slice(0, solMoves.length - targetMoves);
          const newScrambleMoves = simplifyMoves([
            ...baseScramble.split(/\s+/).filter(Boolean),
            ...prefixMoves,
          ]);
          const newScramble = newScrambleMoves.join(' ');
          const newPattern = kpuzzle.defaultPattern().applyAlg(newScramble);
          const newSolutions = solveXCross(newPattern, face, solverSlots);
          if (newSolutions.some(s => s.moveCount === targetMoves)) {
            const newCrossOpt = getCrossOptimalIfValid(newPattern, newSolutions);
            if (newCrossOpt !== null) {
              return { moves: newScramble, solutions: newSolutions, crossOptimal: newCrossOpt };
            }
          }
        }
      }

      return null;
    };

    findValidScramble().then((found) => {
      if (found) {
        const { moves, solutions, crossOptimal: crossOpt } = found;
        scrambleRef.current = moves;
        setScramble(moves);
        setOptimalSolutions(solutions);
        setCrossOptimal(crossOpt);
        const match = targetMoves > 0 ? solutions.filter(s => s.moveCount === targetMoves) : solutions;
        setTargetSlot((match.length > 0 ? match[0] : solutions[0]).slot);
      } else {
        scrambleRef.current = '';
        setScramble('');
        setOptimalSolutions([]);
        setCrossOptimal(-1);
        setTargetSlot('');
      }
      setSolving(false);
    });
  }, [kpuzzle, solverReady]);

  useEffect(() => {
    if (solverReady) generateNewScramble();
  }, [solverReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if XCross is solved (cross + target F2L pair).
  // Uses visual slot name + full displayRotation so positions match the visual display.
  const checkXCrossSolved = useCallback((currentPattern: KPattern, slot: string): boolean => {
    const visualSlot = solverToVisualSlot[slot] ?? slot;
    const slotState = SLOT_SOLVED_STATE[visualSlot] ?? 0;
    if (!slotState) return false;

    if (displayRotation) {
      const rotatedPattern = currentPattern.applyAlg(displayRotation);
      return isPatternSolved(rotatedPattern, SolvedState.CROSS | slotState, 'D');
    }

    return isPatternSolved(currentPattern, SolvedState.CROSS | slotState, crossFace);
  }, [solverToVisualSlot, displayRotation, crossFace]);

  // Handle cube moves during solving
  const handleCubeMoveEvent = useCallback((event: GanCubeEvent) => {
    if (event.type !== 'MOVE') return;

    if (phase === 'solved') {
      isRetryRef.current = true;
      solvedRef.current = false;
      setPhase('scrambling');
      setResult(null);

      movesRef.current = [];
      setMoveCount(0);
      setCaseKey(k => k + 1);
      setShowSliceWarning(false);
      return;
    }

    if (phase !== 'solving' || solvedRef.current) return;

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
      cubeTimerRef.current?.firstMove(timeOfMove);
    }

    const newMove = { move: event.move, timeOfMove };
    const newMoves = [...movesRef.current, newMove];
    movesRef.current = newMoves;
    const moveStrs = newMoves.map(m => m.move);
    setMoveCount(movesToHTM(moveStrs));
    cubeTimerRef.current?.addMove(translateMove(event.move, displayRotation));
    badgesRef.current?.notify();

    const moveString = newMoves.map(m => m.move).join(' ');
    if (kpuzzle && targetSlot) {
      const currentPattern = kpuzzle.defaultPattern().applyAlg(scramble).applyAlg(moveString);
      const isSolved = checkXCrossSolved(currentPattern, targetSlot);

      if (isSolved) {
        solvedRef.current = true;
        const firstMove = newMoves[0].timeOfMove;
        const lastMove = newMoves[newMoves.length - 1].timeOfMove;
        const inspectionMs = firstMove - (cubeTimerRef.current?.getStartTime() ?? 0);
        const executionMs = lastMove - firstMove;
        const userMoves = movesToHTM(newMoves.map(m => m.move));
        const optimal = optimalSolutions.length > 0 ? optimalSolutions[0].moveCount : -1;

        setResult({ userMoves, optimal, inspectionMs, executionMs });
        setPhase('solved');
        setDiffKey(k => k + 1);

        if (isSliceRecovery) {
          setShowSliceWarning(true);
          cubeTimerRef.current?.stopAt(timeOfMove);
        } else {
          cubeTimerRef.current?.stop();
        }

        const stat: XCrossStat = {
          scramble,
          slot: targetSlot,
          userMoveCount: userMoves,
          optimalMoveCount: optimal,
          inspectionMs,
          executionMs,
          timestamp: new Date().toISOString(),
        };
        if (isRetryRef.current) {
          const idx = xcrossStats.findLastIndex(s => s.scramble === scramble);
          setXcrossStats(prev => idx >= 0 ? prev.map((s, i) => i === idx ? (stat.executionMs < s.executionMs ? stat : s) : s) : [...prev, stat]);
        } else {
          setXcrossStats(prev => [...prev, stat]);
        }
      }
    }
  }, [phase, kpuzzle, scramble, optimalSolutions, setXcrossStats, maskAfterFirstMove, crossFace, targetSlot, checkXCrossSolved, xcrossStats, displayRotation]);

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

  const handleRetry = () => {
    isRetryRef.current = true;
    solvedRef.current = false;
    setPhase('scrambling');
    setResult(null);

    movesRef.current = [];
    setMoveCount(0);
    setCaseKey(k => k + 1);
    setShowSliceWarning(false);
    setDiffKey(k => k + 1);
  };

  const handleSkip = () => {
    generateNewScramble();
  };

  // Stats computations
  const recentStats = xcrossStats.slice(-50);
  const optimalCount = recentStats.filter(s => s.userMoveCount === s.optimalMoveCount).length;
  const avgMoves = recentStats.length > 0
    ? (recentStats.reduce((sum, s) => sum + s.userMoveCount, 0) / recentStats.length).toFixed(1)
    : '-';

  const getBestTime = () => {
    if (recentStats.length === 0) return '-';
    return (Math.min(...recentStats.map(s => s.executionMs)) / 1000).toFixed(3);
  };

  const getAoTime = (n: number) => {
    if (recentStats.length < n) return '-';
    const times = recentStats.slice(-n).map(s => s.executionMs);
    return (times.reduce((a, b) => a + b, 0) / n / 1000).toFixed(3);
  };

  const handleDeleteStat = (index: number) => {
    setXcrossStats(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteAll = () => {
    setXcrossStats([]);
  };

  const handleExportData = () => {
    const formatTimestamp = (date: Date) => {
      const pad = (num: number) => (num < 10 ? '0' : '') + num;
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    };
    const timestamp = formatTimestamp(new Date());
    const csvConfig = mkConfig({
      filename: `xcross-stats-${timestamp}`,
      useKeysAsHeaders: true,
      showColumnHeaders: true,
    });
    const csv = generateCsv(csvConfig)(xcrossStats as unknown as Record<string, string | number>[]);
    download(csvConfig)(csv);
  };

  // Rank solutions with optimal y-rotation, filter by move count, group by visual slot
  const rankedSolutions = useMemo(() => {
    const filtered = xcrossMoveCount > 0 ? optimalSolutions.filter(s => s.moveCount === xcrossMoveCount) : optimalSolutions;
    return rankXCrossSolutions(filtered, crossFace);
  }, [optimalSolutions, crossFace, xcrossMoveCount]);

  const solutionsBySlot = useMemo(() => {
    const groups: Record<string, RankedSolution[]> = {};
    for (const sol of rankedSolutions) {
      const visual = solverToVisualSlot[sol.slot ?? ''] ?? sol.slot ?? '';
      if (!groups[visual]) groups[visual] = [];
      groups[visual].push(sol);
    }
    return groups;
  }, [rankedSolutions, solverToVisualSlot]);

  // DataTable columns
  const timesColumns: DataTableColumn<XCrossStat & { id: number }>[] = [
    { accessor: 'index', title: '#', textAlign: 'right', render: (_: XCrossStat, index: number) => xcrossStats.length - index },
    {
      accessor: 'slot', title: 'Slot', textAlign: 'center',
      render: (record: XCrossStat) => <Text fz="xs" ff="monospace" component="span">{record.slot}</Text>,
    },
    {
      accessor: 'userMoveCount', title: 'Moves', textAlign: 'right',
      render: (record: XCrossStat) => (
        <Text fz="xs" ff="monospace" c={record.userMoveCount === record.optimalMoveCount ? 'green' : undefined} component="span">
          {record.userMoveCount}
        </Text>
      ),
    },
    { accessor: 'optimalMoveCount', title: 'Optimal', textAlign: 'right' },
    {
      accessor: 'inspectionMs', title: 'Insp', textAlign: 'right',
      render: (record: XCrossStat) => (record.inspectionMs / 1000).toFixed(3),
    },
    {
      accessor: 'executionMs', title: 'Exec', textAlign: 'right',
      render: (record: XCrossStat) => (record.executionMs / 1000).toFixed(3),
    },
    {
      accessor: 'tps', title: 'TPS', textAlign: 'right',
      render: (record: XCrossStat) => record.executionMs > 0 ? (record.userMoveCount / (record.executionMs / 1000)).toFixed(1) : '-',
    },
  ];

  const summaryColumns = [
    { accessor: 'n', title: 'n', render: () => recentStats.length },
    { accessor: 'optimal', title: 'optimal%', render: () => recentStats.length > 0 ? `${((optimalCount / recentStats.length) * 100).toFixed(0)}%` : '-' },
    { accessor: 'avgMoves', title: 'avg moves', render: () => avgMoves },
    { accessor: 'best', title: 'best', render: () => getBestTime() },
    { accessor: 'ao5', title: 'ao5', render: () => getAoTime(5) },
    { accessor: 'ao12', title: 'ao12', render: () => getAoTime(12) },
  ];

  const summaryRecords = [{ id: 'current' }];

  return (
    <Grid>
      <Grid.Col span={12}>
        <Card withBorder padding="xs">
          <Card.Section withBorder px="xs">
            <Group justify="space-between">
              <Title mt="xs" mb="xs">XCross Trainer</Title>
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
          <SolvedStateBadges ref={badgesRef} kpuzzle={kpuzzle} setupAlg={scramble} effectiveSolvedState={SolvedState.CROSS | (SLOT_SOLVED_STATE[solverToVisualSlot[targetSlot] ?? targetSlot] ?? 0)} displayRotation={displayRotation} movesRef={movesRef} />
        </Card>
      </Grid.Col>
      <Grid.Col span={4}>
        <Card withBorder>
          {!scramble && !solving && !solverReady ? (
            <Stack align="center" gap="xs" p="md">
              <Skeleton height={300} width={300} />
              <Skeleton height={20} width={200} />
              <Skeleton height={60} width="100%" />
            </Stack>
          ) : (
            <>
              <CubeTimerPlayer
                ref={cubeTimerRef}
                setupAlg={setupAlg}
                showHintFacelets={showHintFacelets}
                stickeringMask={stickeringMask}
                kpuzzle={kpuzzle}
                maskAfterFirstMove={maskAfterFirstMove}
                caseKey={caseKey}
                manualStart
                timerAdornment={showSliceWarning ? (
                  <Tooltip label="A BLE notification was dropped during a slice move. The time was adjusted." withArrow>
                    <span style={{ position: 'absolute', top: 4, right: -18, lineHeight: 0 }}>
                      <TbAlertTriangle size={14} color="var(--mantine-color-gray-5)" />
                    </span>
                  </Tooltip>
                ) : undefined}
              />
              <Stack align="center" gap={0}>
                {(() => {
                  const optimalMoves = optimalSolutions.length > 0 ? optimalSolutions[0].moveCount : 0;
                  const curMoves = phase === 'solving' ? moveCount : (result ? result.userMoves : 0);
                  const moveColor = curMoves > optimalMoves ? 'red' : (phase === 'solved' ? 'green' : 'dimmed');
                  return (
                    <Text fz="lg" fw={700} c={moveColor}>
                      {curMoves} moves
                    </Text>
                  );
                })()}
              </Stack>

              <Divider label="Scramble" />

              <Box px="xs" py="xs">
                {solving ? (
                  <Text fz="sm" c="dimmed">Searching for a scramble...</Text>
                ) : !scramble ? (
                  <Text fz="sm" c="red" fw={700}>No scrambles found!</Text>
                ) : (
                  <DifferentialScramble
                    key={diffKey}
                    conn={conn}
                    kpuzzle={kpuzzle}
                    scramble={scramble}
                    phase={phase}
                    onScrambleComplete={handleScrambleComplete}
                  />
                )}
              </Box>

          <Divider
            label={
              <Group gap={4}>
                {solutionsOpen ? <TbChevronUp size={14} /> : <TbChevronDown size={14} />}
                <Text fz="xs" fw={500}>Solutions</Text>
                {solutionsOpen ? <TbChevronUp size={14} /> : <TbChevronDown size={14} />}
              </Group>
            }
            labelPosition="center"
            onClick={() => setSolutionsOpen(o => !o)}
            style={{ cursor: 'pointer' }}
          />

          {solutionsOpen && (
            <Box px="xs" py="xs">
              {optimalSolutions.length > 0 ? (
                optimalSolutions[0].moveCount === 0 ? (
                  <Text fz="sm" c="green" fw={700}>Already solved!</Text>
                ) : rankedSolutions.length === 0 ? (
                  <Text fz="sm" c="dimmed">No {xcrossMoveCount}-move solutions</Text>
                ) : (
                  <Stack gap="xs">
                    {crossOptimal >= 0 && (
                      <Text fz="xs" c="dimmed">Cross optimal: {crossOptimal} moves</Text>
                    )}
                    {Object.entries(solutionsBySlot).map(([slot, sols]) => {
                      const moveCount = sols[0].solution.split(' ').filter(Boolean).length;
                      return (
                        <Box key={slot}>
                          <Text fz="xs" fw={700} c="dimmed" mb={2}>{slot} slot ({moveCount} moves)</Text>
                          <Stack gap={2}>
                            {sols.slice(0, 10).map((sol, i) => (
                              <Text key={i} fz="sm" ff="monospace" c="dimmed">
                                {sol.rotation ? `[${sol.rotation}] ` : ''}{sol.solution}
                              </Text>
                            ))}
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                )
              ) : solving ? (
                <Text fz="sm" c="dimmed">Computing...</Text>
              ) : null}
            </Box>
          )}
            </>
          )}
        </Card>
      </Grid.Col>
      <Grid.Col span={4}>
        <Stack>
          <Card withBorder padding={0}>
            <Card.Section withBorder px="xs">
              <Title order={4} my={4}>Stats</Title>
            </Card.Section>
            <DataTable
              ff="monospace"
              fz="xs"
              verticalSpacing={0}
              horizontalSpacing="xs"
              columns={summaryColumns}
              records={summaryRecords}
              defaultColumnProps={{
                textAlign: 'center',
              }}
            />
          </Card>
          <Card withBorder padding={0} style={{ display: 'flex', flexDirection: 'column' as const, maxHeight: 'calc(100vh - 500px)' }}>
            <Card.Section withBorder px="xs">
              <Group justify="space-between">
                <Title order={4} my={4}>Times</Title>
                <Menu withinPortal position="bottom-end" shadow="sm">
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray">
                      <TbDots style={{ width: rem(16), height: rem(16) }} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<TbInfoCircle />} disabled>
                      Hint: double-click a row to remove that time
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<TbDownload style={{ width: rem(14), height: rem(14) }} />}
                      onClick={handleExportData}
                    >
                      Export to CSV
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<TbTrash style={{ width: rem(14), height: rem(14) }} />}
                      color="red"
                      onClick={() => setConfirmDeleteAll(true)}
                    >
                      Delete all
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Card.Section>
            <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <DataTable
                ff="monospace"
                fz="xs"
                withRowBorders={false}
                verticalSpacing={0}
                horizontalSpacing="xs"
                highlightOnHover
                striped
                columns={timesColumns}
                records={xcrossStats.toReversed().slice(0, 50).map((stat, index) => ({ ...stat, id: index }))}
                onRowDoubleClick={({ index }) => handleDeleteStat(xcrossStats.length - 1 - index)}
                rowStyle={() => ({ cursor: 'not-allowed' })}
              />
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
            <Divider label="Display Settings" />
            <Checkbox
              label="Show Hint Facelets"
              checked={showHintFacelets}
              onChange={(e) => setShowHintFacelets(e.currentTarget.checked)}
            />
            <Tooltip label="3D cube can optionally grey out unimportant stickers to your current case" withArrow>
              <Box display="inline-flex">
                <Checkbox
                  label="Use Maskings"
                  checked={useMaskings}
                  onChange={(e) => setUseMaskings(e.currentTarget.checked)}
                />
              </Box>
            </Tooltip>
            <Tooltip label="Grey out all stickers after the first cube move for blind solving practice" withArrow>
              <Box display="inline-flex">
                <Checkbox
                  label="Mask After First Move"
                  checked={maskAfterFirstMove}
                  onChange={(e) => setMaskAfterFirstMove(e.currentTarget.checked)}
                />
              </Box>
            </Tooltip>
            <Divider label="Preorientation" />
            <Group gap="xs" align="center">
              <Text fz="sm">Cross:</Text>
              <FaceColorPicker value={crossColors} onChange={setCrossColors} />
            </Group>
            <Group gap="xs" align="center">
              <Tooltip label="Add random rotations around an axis after preorientation to train solving from different angles" withArrow multiline w={250}>
                <Text fz="sm" style={{ cursor: 'help', textDecoration: 'underline dotted' }}>Random:</Text>
              </Tooltip>
              <Select
                value={randomRotationAxis}
                maw="70px"
                size="xs"
                placeholder="-"
                clearable
                onChange={(value) => setRandomRotationAxis(value || '')}
                data={["x", "y", "z"]}
              />
            </Group>
            <Divider label="Solution Filter" />
            <Text fz="sm">Moves: {xcrossMoveCount === 0 ? 'any' : xcrossMoveCount}</Text>
            <Slider
              min={0}
              max={10}
              step={1}
              value={xcrossMoveCount}
              onChange={setXcrossMoveCount}
              marks={[{ value: 0, label: 'any' }, { value: 5, label: '5' }, { value: 10, label: '10' }]}
              size="sm"
              mb="xs"
            />
            <Text fz="sm">Min extra over cross: {minExtraMoves}</Text>
            <Slider
              min={0}
              max={5}
              step={1}
              value={minExtraMoves}
              onChange={setMinExtraMoves}
              marks={[{ value: 0, label: '0' }, { value: 5, label: '5' }]}
              size="sm"
              mb="xs"
            />
            <Divider label="F2L Slots" />
            <Chip.Group multiple value={selectedSlots} onChange={(val: string[]) => {
              if (val.length > 0) setSelectedSlots(val);
            }}>
              <Group gap="xs">
                {['FR', 'FL', 'BL', 'BR'].map(slot => (
                  <Chip key={slot} value={slot} size="xs">
                    {slot}
                  </Chip>
                ))}
              </Group>
            </Chip.Group>
          </Stack>
        </Card>
      </Grid.Col>
      <Modal opened={confirmDeleteAll} onClose={() => setConfirmDeleteAll(false)} title="Delete All Times" centered>
        <Text mb="md">Are you sure you want to delete all XCross trainer times? This can't be undone.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmDeleteAll(false)}>Cancel</Button>
          <Button color="red" onClick={() => { handleDeleteAll(); setConfirmDeleteAll(false); }}>Delete All</Button>
        </Group>
      </Modal>
    </Grid>
  );
};

export default XCrossTrainerView;
