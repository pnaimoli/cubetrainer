import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { Grid, Card, Box, Text, Title, Group, Stack, Button, Checkbox, Tooltip, Divider, Menu, ActionIcon, rem, Modal, SegmentedControl, Skeleton, Select, Slider } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { DataTable, DataTableColumn } from 'mantine-datatable';
import { mkConfig, generateCsv, download } from 'export-to-csv';
import { TbRefresh, TbArrowRight, TbAlertTriangle, TbDots, TbTrash, TbInfoCircle, TbDownload, TbChevronDown, TbChevronUp, TbReport } from 'react-icons/tb';
import { KPuzzle, KPattern } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

import { Settings, SolvedState, Move } from '../util/interfaces';
import { isPatternSolved } from '../util/SolveChecker';
import { generateStickeringMask } from '../util/StickeringMask';
import { initCrossSolver, solveCross, CrossSolution } from '../util/crossSolver';
import { generateCrossScramble, rotateScramble } from '../util/scrambleGenerator';
import { movesToHTM, simplifyMoves } from '../util/cubeState';
import { rankCrossSolutions, RankedSolution } from '../util/crossSolutionRanker';
import { FACE_TO_D_ROTATION, translateMove, randomRotationString } from '../util/crossRotation';
import FaceColorPicker from './FaceColorPicker';
import DifferentialScramble from './DifferentialScramble';
import CubeTimerPlayer, { CubeTimerPlayerHandle } from './CubeTimerPlayer';
import { SolvedStateBadges, SolvedStateBadgesHandle } from './TrainerView';
import CrossReportsView from './CrossReportsView';

interface MoveCountDisplayHandle {
  update: (moves: number, gens: number) => void;
}

interface MoveCountDisplayProps {
  optimalMoves: number;
  optimalGen: number;
  phase: string;
  result: { userMoves: number } | null;
}

const MoveCountDisplay = React.forwardRef<MoveCountDisplayHandle, MoveCountDisplayProps>(
  ({ optimalMoves, optimalGen, phase, result }, ref) => {
    const [moves, setMoves] = useState(0);
    const [gens, setGens] = useState(0);

    React.useImperativeHandle(ref, () => ({
      update: (m: number, g: number) => { setMoves(m); setGens(g); },
    }));

    const curMoves = phase === 'solving' ? moves : (result ? result.userMoves : 0);
    const curGen = phase === 'solving' ? gens : gens;
    const showResult = phase === 'solved' || (phase === 'scrambling' && result);
    const moveColor = curMoves > optimalMoves ? 'red' : (showResult ? 'green' : 'dimmed');
    const gColor = curGen > optimalGen ? 'red' : (showResult ? 'green' : 'dimmed');
    return (
      <Text fz="lg" fw={700} c="dimmed">
        <Text span c={moveColor} inherit>{curMoves} moves</Text>
        {' ('}
        <Text span c={gColor} inherit>{curGen}-gen</Text>
        {')'}
      </Text>
    );
  }
);

interface CrossTrainerViewProps {
  conn: GanCubeConnection | null;
  settings: Settings;
}

interface CrossStat {
  scramble: string;
  userMoveCount: number;
  optimalMoveCount: number;
  inspectionMs: number;
  executionMs: number;
  timestamp: string;
}

type Phase = 'scrambling' | 'solving' | 'solved';

const CrossTrainerView: React.FC<CrossTrainerViewProps> = ({ conn, settings }) => {
  const [kpuzzle, setKpuzzle] = useState<KPuzzle | null>(null);
  const [solverReady, setSolverReady] = useState(false);
  const [scramble, setScramble] = useState<string>('');
  const [optimalSolutions, setOptimalSolutions] = useState<CrossSolution[]>([]);
  const [scrambledPattern, setScrambledPattern] = useState<KPattern | null>(null);
  const [phase, setPhase] = useState<Phase>('scrambling');
  const [selectedGen, setSelectedGen] = useState<string>('');
  const [diffKey, setDiffKey] = useState(0);
  const movesRef = useRef<Move[]>([]);
  const [caseKey, setCaseKey] = useState(0);
  const [result, setResult] = useState<{ userMoves: number; optimal: number; inspectionMs: number; executionMs: number } | null>(null);
  const userMoveCountRef = useRef(0);
  const userGenCountRef = useRef(0);
  const moveCountDisplayRef = useRef<MoveCountDisplayHandle>(null);
  const [showSliceWarning, setShowSliceWarning] = useState(false);
  const isRetryRef = useRef(false);
  const solvedRef = useRef(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [solving, setSolving] = useState(false);
  const [searchAttempt, setSearchAttempt] = useState(0);

  const [crossStats, setCrossStats] = useLocalStorage<CrossStat[]>({ key: 'crossStats', defaultValue: [], getInitialValueInEffect: false });
  const [showHintFacelets, setShowHintFacelets] = useLocalStorage<boolean>({ key: 'cross_showHintFacelets', defaultValue: settings.showHintFacelets, getInitialValueInEffect: false });
  const [useMaskings, setUseMaskings] = useLocalStorage<boolean>({ key: 'cross_useMaskings', defaultValue: settings.useMaskings, getInitialValueInEffect: false });
  const [maskAfterFirstMove, setMaskAfterFirstMove] = useLocalStorage<boolean>({ key: 'cross_maskAfterFirstMove', defaultValue: settings.maskAfterFirstMove, getInitialValueInEffect: false });
  const [crossColor, setCrossColor] = useLocalStorage<string>({ key: 'crossColor', defaultValue: 'D', getInitialValueInEffect: false });
  const crossColorRef = useRef(crossColor);
  crossColorRef.current = crossColor;
  const [crossFace, setCrossFace] = useState('D');
  const [randomRotationAxis, setRandomRotationAxis] = useLocalStorage<string>({ key: 'crossRandomRotation', defaultValue: '', getInitialValueInEffect: false });
  const randomRotationAxisRef = useRef(randomRotationAxis);
  randomRotationAxisRef.current = randomRotationAxis;
  const [extraRotation, setExtraRotation] = useState('');

  // Exact move count filter (0 = any)
  const [crossMoveCount, setCrossMoveCount] = useLocalStorage<number>({ key: 'crossMoveCount', defaultValue: 0, getInitialValueInEffect: false });

  // Cross pieces in place filter
  const [crossPip, setCrossPip] = useState<number | null>(null);
  const crossPipRef = useRef(crossPip);
  crossPipRef.current = crossPip;

  // Retry override policy: 'fastest' | 'latest' | 'never'
  const [retryPolicy, setRetryPolicy] = useLocalStorage<string>({ key: 'crossRetryPolicy', defaultValue: 'fastest', getInitialValueInEffect: false });

  // Clear old stats that lack the new inspectionMs/executionMs fields
  useEffect(() => {
    if (crossStats.length > 0 && !('executionMs' in crossStats[0])) {
      setCrossStats([]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cubeTimerRef = useRef<CubeTimerPlayerHandle>(null);
  const badgesRef = useRef<SolvedStateBadgesHandle>(null);
  const scrambleRef = useRef<string>('');

  const displayRotation = [FACE_TO_D_ROTATION[crossFace], extraRotation].filter(Boolean).join(' ');
  const setupAlg = useMemo(() =>
    displayRotation ? `${scramble} ${displayRotation}` : scramble,
    [scramble, displayRotation],
  );

  // Stickering mask for cross (show only cross-relevant stickers)
  const stickeringMask = useMemo(() => {
    if (!useMaskings || !kpuzzle || !scramble) return null;
    const setupPattern = kpuzzle.defaultPattern().applyAlg(scramble);
    return generateStickeringMask(setupPattern, SolvedState.CROSS, crossFace);
  }, [useMaskings, kpuzzle, scramble, crossFace]);

  // Ranked solution groups by gen level
  const genGroups = useMemo(() =>
    rankCrossSolutions(optimalSolutions, scrambledPattern ?? undefined, crossFace),
    [optimalSolutions, scrambledPattern, crossFace],
  );

  // Active gen group based on segmented control
  const activeGroup = useMemo(() => {
    if (genGroups.length === 0) return null;
    return genGroups.find(g => String(g.genCount) === selectedGen) ?? genGroups[0];
  }, [genGroups, selectedGen]);

  // Segmented control data: highest gen first, with n-1 gen always present (disabled if not found)
  const genSegmentData = useMemo(() => {
    if (genGroups.length === 0) return [];
    const maxGen = genGroups[0].genCount;
    const minGen = Math.max(2, maxGen - 2);
    const data: { label: string; value: string; disabled: boolean }[] = [];
    for (let g = maxGen; g >= minGen; g--) {
      const group = genGroups.find(gr => gr.genCount === g);
      data.push({
        label: group ? `${g}-gen (${group.moveCount})` : `${g}-gen`,
        value: String(g),
        disabled: !group,
      });
    }
    return data;
  }, [genGroups]);

  // Auto-select the optimal gen (highest gen = fewest moves) when groups change
  useEffect(() => {
    if (genGroups.length > 0) {
      setSelectedGen(String(genGroups[0].genCount));
    }
  }, [genGroups]);

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
    setResult(null);
    movesRef.current = [];
    userMoveCountRef.current = 0;
    userGenCountRef.current = 0;
    moveCountDisplayRef.current?.update(0, 0);
    cubeTimerRef.current?.start();
  }, []);

  const moveCountRef = useRef(crossMoveCount);
  moveCountRef.current = crossMoveCount;

  // Generate new scramble using direct state construction
  const generateNewScramble = useCallback(async () => {
    if (!kpuzzle || !solverReady) return;

    const face = crossColorRef.current;
    const targetMoves = moveCountRef.current;

    setSolving(true);
    setScramble('');
    setOptimalSolutions([]);
    setScrambledPattern(null);

    let finalScramble = '';
    let finalSolutions: CrossSolution[] = [];
    let finalPattern: KPattern | null = null;

    for (let attempt = 0; attempt < 20; attempt++) {
      setSearchAttempt(attempt + 1);

      const { scramble: dScramble } = await generateCrossScramble(kpuzzle, {
        piecesInPlace: crossPipRef.current,
      });

      const baseScramble = face === 'D' ? dScramble : rotateScramble(dScramble, face);
      const basePattern = kpuzzle.defaultPattern().applyAlg(baseScramble);
      const solutions = solveCross(basePattern, face);

      if (targetMoves === 0 || (solutions.length > 0 && solutions[0].moveCount === targetMoves)) {
        finalScramble = baseScramble;
        finalSolutions = solutions;
        finalPattern = basePattern;
        break;
      } else if (solutions.length > 0 && solutions[0].moveCount > targetMoves) {
        const solMoves = solutions[0].solution.split(/\s+/).filter(Boolean);
        const prefixMoves = solMoves.slice(0, solMoves.length - targetMoves);
        const newScrambleMoves = simplifyMoves([
          ...baseScramble.split(/\s+/).filter(Boolean),
          ...prefixMoves,
        ]);
        const newScramble = newScrambleMoves.join(' ');
        const newPattern = kpuzzle.defaultPattern().applyAlg(newScramble);
        const newSolutions = solveCross(newPattern, face);
        if (newSolutions.length > 0 && newSolutions[0].moveCount === targetMoves) {
          finalScramble = newScramble;
          finalSolutions = newSolutions;
          finalPattern = newPattern;
          break;
        }
      }
    }

    setSolving(false);
    scrambleRef.current = finalScramble;
    setScramble(finalScramble);
    setOptimalSolutions(finalSolutions);
    setScrambledPattern(finalPattern);
    setCrossFace(face);
    setExtraRotation(randomRotationString(randomRotationAxisRef.current));
    isRetryRef.current = false;
    solvedRef.current = false;
    setPhase('scrambling');
    setResult(null);
    cubeTimerRef.current?.reset();

    movesRef.current = [];
    userMoveCountRef.current = 0;
    userGenCountRef.current = 0;
    moveCountDisplayRef.current?.update(0, 0);
    setCaseKey(k => k + 1);
    setShowSliceWarning(false);
    setDiffKey(k => k + 1);
  }, [kpuzzle, solverReady]);

  useEffect(() => {
    if (solverReady) generateNewScramble();
  }, [solverReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle cube moves during solving
  const handleCubeMoveEvent = useCallback((event: GanCubeEvent) => {
    if (event.type !== 'MOVE') return;

    // Auto-retry: any cube move after solve triggers retry (ScrambleGuide tracks it independently)
    if (phase === 'solved') {
      isRetryRef.current = true;
      solvedRef.current = false;
      setPhase('scrambling');

      movesRef.current = [];
      userMoveCountRef.current = 0;
      userGenCountRef.current = 0;
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
    const simplified = simplifyMoves(moveStrs);
    userMoveCountRef.current = simplified.length;
    userGenCountRef.current = new Set(simplified.map(m => m.charAt(0))).size;
    moveCountDisplayRef.current?.update(userMoveCountRef.current, userGenCountRef.current);
    cubeTimerRef.current?.addMove(translateMove(event.move, displayRotation));
    badgesRef.current?.notify();

    const moveString = newMoves.map(m => m.move).join(' ');
    if (kpuzzle) {
      const currentPattern = kpuzzle.defaultPattern().applyAlg(scramble).applyAlg(moveString);
      const isSolved = isPatternSolved(currentPattern, SolvedState.CROSS, crossFace);

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

        const stat: CrossStat = {
          scramble,
          userMoveCount: userMoves,
          optimalMoveCount: optimal,
          inspectionMs,
          executionMs,
          timestamp: new Date().toISOString(),
        };
        if (isRetryRef.current && retryPolicy !== 'never') {
          const idx = crossStats.findLastIndex(s => s.scramble === scramble);
          if (idx >= 0) {
            setCrossStats(prev => prev.map((s, i) => {
              if (i !== idx) return s;
              if (retryPolicy === 'latest') return stat;
              return stat.executionMs < s.executionMs ? stat : s; // 'fastest'
            }));
          } else {
            setCrossStats(prev => [...prev, stat]);
          }
        } else if (!isRetryRef.current) {
          setCrossStats(prev => [...prev, stat]);
        }
      }
    }
  }, [phase, kpuzzle, scramble, optimalSolutions, setCrossStats, maskAfterFirstMove, crossFace, displayRotation, retryPolicy, crossStats]);

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
    cubeTimerRef.current?.stop();
    setPhase('scrambling');
    setResult(null);

    movesRef.current = [];
    userMoveCountRef.current = 0;
    userGenCountRef.current = 0;
    moveCountDisplayRef.current?.update(0, 0);
    setCaseKey(k => k + 1);
    setShowSliceWarning(false);
    setDiffKey(k => k + 1);
  };

  const handleSkip = () => {
    generateNewScramble();
  };

  // Stats computations
  const recentStats = crossStats.slice(-50);
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
    setCrossStats(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteAll = () => {
    setCrossStats([]);
  };

  const handleExportData = () => {
    const formatTimestamp = (date: Date) => {
      const pad = (num: number) => (num < 10 ? '0' : '') + num;
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    };
    const timestamp = formatTimestamp(new Date());
    const csvConfig = mkConfig({
      filename: `cross-stats-${timestamp}`,
      useKeysAsHeaders: true,
      showColumnHeaders: true,
    });
    const csv = generateCsv(csvConfig)(crossStats as unknown as Record<string, string | number>[]);
    download(csvConfig)(csv);
  };

  // Format ranked solution display
  const formatRankedSolution = (rs: RankedSolution) => {
    const prefix = rs.rotation ? `[${rs.rotation}] ` : '';
    return `${prefix}${rs.solution}`;
  };

  // DataTable columns for times list
  const timesColumns: DataTableColumn<CrossStat & { id: number }>[] = [
    { accessor: 'index', title: '#', textAlign: 'right', render: (_: CrossStat, index: number) => crossStats.length - index },
    {
      accessor: 'userMoveCount', title: 'Moves', textAlign: 'right',
      render: (record: CrossStat) => (
        <Text fz="xs" ff="monospace" c={record.userMoveCount === record.optimalMoveCount ? 'green' : undefined} component="span">
          {record.userMoveCount}
        </Text>
      ),
    },
    { accessor: 'optimalMoveCount', title: 'Optimal', textAlign: 'right' },
    {
      accessor: 'inspectionMs', title: 'Insp', textAlign: 'right',
      render: (record: CrossStat) => (record.inspectionMs / 1000).toFixed(3),
    },
    {
      accessor: 'executionMs', title: 'Exec', textAlign: 'right',
      render: (record: CrossStat) => (record.executionMs / 1000).toFixed(3),
    },
    {
      accessor: 'tps', title: 'TPS', textAlign: 'right',
      render: (record: CrossStat) => record.executionMs > 0 ? (record.userMoveCount / (record.executionMs / 1000)).toFixed(1) : '-',
    },
  ];

  // Summary stats DataTable
  const summaryColumns = [
    { accessor: 'n', title: 'n', render: () => recentStats.length },
    { accessor: 'optimal', title: 'optimal%', render: () => recentStats.length > 0 ? `${((optimalCount / recentStats.length) * 100).toFixed(0)}%` : '-' },
    { accessor: 'avgMoves', title: 'avg moves', render: () => avgMoves },
    { accessor: 'best', title: 'best', render: () => getBestTime() },
    { accessor: 'ao5', title: 'ao5', render: () => getAoTime(5) },
    { accessor: 'ao12', title: 'ao12', render: () => getAoTime(12) },
  ];

  const summaryRecords = [{ id: 'current' }];

  if (showReports) {
    return <CrossReportsView stats={crossStats} onBack={() => setShowReports(false)} />;
  }

  return (
    <Grid>
      <Grid.Col span={12}>
        <Card withBorder padding={0}>
          <Card.Section withBorder px="xs" py="xs">
            <Group justify="space-between" wrap="wrap">
              <Title style={{ fontSize: 'clamp(1.25rem, 7vw, var(--mantine-h1-font-size))', whiteSpace: 'nowrap' }}>Optimal Cross Trainer</Title>
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
          <SolvedStateBadges ref={badgesRef} kpuzzle={kpuzzle} setupAlg={scramble} effectiveSolvedState={SolvedState.CROSS} displayRotation={displayRotation} movesRef={movesRef} />
        </Card>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 4 }}>
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
                <MoveCountDisplay
                  ref={moveCountDisplayRef}
                  optimalMoves={optimalSolutions.length > 0 ? optimalSolutions[0].moveCount : 0}
                  optimalGen={genGroups.length > 0 ? genGroups[0].genCount : 0}
                  phase={phase}
                  result={result}
                />
              </Stack>

              <Divider label="Scramble" />

              <Box px="xs" py="xs">
                {solving ? (
                  <Text fz="sm" c="dimmed">Searching ({searchAttempt}/20)...</Text>
                ) : !scramble ? (
                  <Stack gap={2}>
                    <Text fz="sm" c="red" fw={700}>No Scramble Found!</Text>
                    <Text fz="xs" c="dimmed">Press &lt;New Scramble&gt; to try again.</Text>
                  </Stack>
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
              {genGroups.length > 0 ? (
                <>
                  <SegmentedControl
                    size="xs"
                    value={selectedGen}
                    onChange={(val) => {
                      // Only allow selecting non-disabled values
                      const seg = genSegmentData.find(d => d.value === val);
                      if (seg && !seg.disabled) setSelectedGen(val);
                    }}
                    data={genSegmentData}
                    mb="xs"
                  />
                  {activeGroup && (
                    <Stack gap={2}>
                      {activeGroup.solutions.map((sol, i) => (
                        <Text key={i} fz="sm" ff="monospace" c="dimmed">{formatRankedSolution(sol)}</Text>
                      ))}
                    </Stack>
                  )}
                </>
              ) : optimalSolutions.length > 0 && optimalSolutions[0].moveCount === 0 ? (
                <Text fz="sm" c="green" fw={700}>Already solved!</Text>
              ) : null}
            </Box>
          )}
            </>
          )}
        </Card>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 4 }}>
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
                      leftSection={<TbReport style={{ width: rem(14), height: rem(14) }} />}
                      onClick={() => setShowReports(true)}
                    >
                      Reports
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
                records={crossStats.toReversed().map((stat, index) => ({ ...stat, id: index }))}
                onRowDoubleClick={({ index }) => handleDeleteStat(crossStats.length - 1 - index)}
                rowStyle={() => ({ cursor: 'pointer' })}
              />
            </Box>
          </Card>
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 4 }}>
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
              <FaceColorPicker value={crossColor} onChange={setCrossColor} />
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
            <Divider label="Retry Override" />
            <SegmentedControl
              size="xs"
              value={retryPolicy}
              onChange={setRetryPolicy}
              data={[
                { label: 'Fastest', value: 'fastest' },
                { label: 'Latest', value: 'latest' },
                { label: 'Keep First', value: 'never' },
              ]}
            />
            <Divider label="Solution Filter" />
            <Group wrap="nowrap" gap="xs" align="center" mb="xs">
              <Tooltip label="Filter scrambles to a specific optimal cross move count" withArrow multiline w={250}>
                <Text fz="sm" style={{ whiteSpace: 'nowrap', minWidth: '33%', cursor: 'help', textDecoration: 'underline dotted' }}>Cross Length:</Text>
              </Tooltip>
              <Slider
                min={0}
                max={8}
                step={1}
                value={crossMoveCount}
                onChange={setCrossMoveCount}
                marks={Array.from({ length: 9 }, (_, i) => ({ value: i, label: i === 0 ? 'any' : String(i) }))}
                size="sm"
                style={{ flex: 1 }}
              />
            </Group>
            <Group wrap="nowrap" gap="xs" align="center" mb="lg">
              <Tooltip label="Filter by how many cross edges are already correctly positioned and oriented (best over all cross-face rotations)" withArrow multiline w={300}>
                <Text fz="sm" style={{ whiteSpace: 'nowrap', minWidth: '33%', cursor: 'help', textDecoration: 'underline dotted' }}>Pieces in Place:</Text>
              </Tooltip>
              <Slider
                min={-1}
                max={4}
                step={1}
                size="sm"
                value={crossPip === null ? -1 : crossPip}
                onChange={(v) => setCrossPip(v === -1 ? null : v)}
                marks={[{ value: -1, label: 'any' }, ...Array.from({ length: 5 }, (_, i) => ({ value: i, label: String(i) }))]}
                style={{ flex: 1 }}
              />
            </Group>
          </Stack>
        </Card>
      </Grid.Col>
      <Modal opened={confirmDeleteAll} onClose={() => setConfirmDeleteAll(false)} title="Delete All Times" centered>
        <Text mb="md">Are you sure you want to delete all cross trainer times? This can't be undone.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmDeleteAll(false)}>Cancel</Button>
          <Button color="red" onClick={() => { handleDeleteAll(); setConfirmDeleteAll(false); }}>Delete All</Button>
        </Group>
      </Modal>
    </Grid>
  );
};

export default CrossTrainerView;
