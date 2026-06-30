import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { Grid, Card, Box, Text, Title, Group, Stack, Button, Checkbox, Tooltip, Divider, Menu, ActionIcon, rem, Modal, SegmentedControl, Skeleton, Select } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { DataTable, DataTableColumn } from 'mantine-datatable';
import { mkConfig, generateCsv, download } from 'export-to-csv';
import { TbRefresh, TbArrowRight, TbAlertTriangle, TbDots, TbTrash, TbInfoCircle, TbDownload, TbChevronDown, TbChevronUp } from 'react-icons/tb';
import 'cubing/twisty';
import { TwistyPlayer } from 'cubing/twisty';
import { KPuzzle, KPattern } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

import { Settings, SolvedState, Move } from '../util/interfaces';
import { isPatternSolved } from '../util/SolveChecker';
import { generateStickeringMask } from '../util/StickeringMask';
import { PuzzleStickering, PieceStickering, StickeringManager } from '../util/mask';
import { randomScrambleForEvent } from 'cubing/scramble';
import { initCrossSolver, solveCross, CrossSolution } from '../util/crossSolver';
import { movesToHTM } from '../util/cubeState';
import { rankCrossSolutions, RankedSolution } from '../util/crossSolutionRanker';
import { FACE_TO_D_ROTATION, translateMove, randomRotationString } from '../util/crossRotation';
import FaceColorPicker from './FaceColorPicker';
import DifferentialScramble from './DifferentialScramble';
import SolveTimer, { SolveTimerHandle } from './SolveTimer';
import { SolvedStateBadges, SolvedStateBadgesHandle } from './TrainerView';

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
  const [scrambledPattern, setScrambledPattern] = useState<KPattern | null>(null);
  const [phase, setPhase] = useState<Phase>('scrambling');
  const [selectedGen, setSelectedGen] = useState<string>('');
  const [diffKey, setDiffKey] = useState(0);
  const movesRef = useRef<Move[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [result, setResult] = useState<{ userMoves: number; optimal: number; inspectionMs: number; executionMs: number } | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [genCount, setGenCount] = useState(0);
  const [showSliceWarning, setShowSliceWarning] = useState(false);
  const isRetryRef = useRef(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);

  const [crossStats, setCrossStats] = useLocalStorage<CrossStat[]>({ key: 'crossStats', defaultValue: [] });
  const [showHintFacelets, setShowHintFacelets] = useState(settings.showHintFacelets);
  const [useMaskings, setUseMaskings] = useState(settings.useMaskings);
  const [maskAfterFirstMove, setMaskAfterFirstMove] = useState(settings.maskAfterFirstMove);
  const [crossColors, setCrossColors] = useLocalStorage<string[]>({ key: 'crossColors', defaultValue: ['D'], getInitialValueInEffect: false });
  const crossColorsRef = useRef(crossColors);
  crossColorsRef.current = crossColors;
  const [crossFace, setCrossFace] = useState('D');
  const [randomRotationAxis, setRandomRotationAxis] = useLocalStorage<string>({ key: 'crossRandomRotation', defaultValue: '' });
  const randomRotationAxisRef = useRef(randomRotationAxis);
  randomRotationAxisRef.current = randomRotationAxis;
  const [extraRotation, setExtraRotation] = useState('');

  // Clear old stats that lack the new inspectionMs/executionMs fields
  useEffect(() => {
    if (crossStats.length > 0 && !('executionMs' in crossStats[0])) {
      setCrossStats([]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const playerRef = useRef<TwistyPlayer>(null);
  const timerRef = useRef<SolveTimerHandle>(null);
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
    movesRef.current = [];
    timerRef.current?.start();
  }, []);

  // Generate new scramble from solved, then compute differential from cube state
  const generateNewScramble = useCallback(async () => {
    if (!kpuzzle || !solverReady) return;

    const colors = crossColorsRef.current;
    const face = colors[Math.floor(Math.random() * colors.length)];
    const scrambleAlg = await randomScrambleForEvent('333');
    const moves = scrambleAlg.toString();
    const targetPattern = kpuzzle.defaultPattern().applyAlg(moves);
    const solutions = solveCross(targetPattern, face);

    scrambleRef.current = moves;
    setScramble(moves);

    setOptimalSolutions(solutions);
    setScrambledPattern(targetPattern);
    setCrossFace(face);
    setExtraRotation(randomRotationString(randomRotationAxisRef.current));
    isRetryRef.current = false;
    setPhase('scrambling');
    setResult(null);

    movesRef.current = [];
    setMoveCount(0);
    setGenCount(0);
    setStartTime(Date.now());
    setShowSliceWarning(false);
    setDiffKey(k => k + 1);
  }, [kpuzzle, solverReady]);

  useEffect(() => {
    if (solverReady) generateNewScramble();
  }, [solverReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply stickering mask
  useEffect(() => {
    if (!playerRef.current) return;
    playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(stickeringMask);
  }, [stickeringMask]);

  // Reset player alg on new scramble, restore stickering mask
  useEffect(() => {
    if (movesRef.current.length === 0 && playerRef.current) {
      playerRef.current.alg = '';
      playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(stickeringMask);
    }
  }, [startTime, stickeringMask]);

  // When maskAfterFirstMove is toggled off, restore normal stickering
  useEffect(() => {
    if (!maskAfterFirstMove && playerRef.current) {
      playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(stickeringMask);
    }
  }, [maskAfterFirstMove]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle cube moves during solving
  const handleCubeMoveEvent = useCallback((event: GanCubeEvent) => {
    if (event.type !== 'MOVE') return;

    // Auto-retry: any cube move after solve triggers retry (ScrambleGuide tracks it independently)
    if (phase === 'solved') {
      isRetryRef.current = true;
      setPhase('scrambling');
      setResult(null);
  
      movesRef.current = [];
      setMoveCount(0);
      setGenCount(0);
      setStartTime(Date.now());
      setShowSliceWarning(false);
      return;
    }

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
      timerRef.current?.firstMove(timeOfMove);
      // Mask after first move: grey out all stickers for blind practice
      if (maskAfterFirstMove && kpuzzle && playerRef.current) {
        const bm = new PuzzleStickering(kpuzzle);
        const mgr = new StickeringManager(kpuzzle);
        bm.set(mgr.all(), PieceStickering.Ignored);
        playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(bm.toStickeringMask());
      }
    }

    const newMove = { move: event.move, timeOfMove };
    const newMoves = [...movesRef.current, newMove];
    movesRef.current = newMoves;
    const moveStrs = newMoves.map(m => m.move);
    setMoveCount(movesToHTM(moveStrs));
    setGenCount(new Set(moveStrs.map(m => m.charAt(0))).size);
    playerRef.current?.experimentalAddMove(translateMove(event.move, displayRotation));
    badgesRef.current?.notify();

    const moveString = newMoves.map(m => m.move).join(' ');
    if (kpuzzle) {
      const currentPattern = kpuzzle.defaultPattern().applyAlg(scramble).applyAlg(moveString);
      const isSolved = isPatternSolved(currentPattern, SolvedState.CROSS, crossFace);

      if (isSolved) {
        const firstMove = newMoves[0].timeOfMove;
        const lastMove = newMoves[newMoves.length - 1].timeOfMove;
        const inspectionMs = firstMove - startTime;
        const executionMs = lastMove - firstMove;
        const userMoves = movesToHTM(newMoves.map(m => m.move));
        const optimal = optimalSolutions.length > 0 ? optimalSolutions[0].moveCount : -1;

        setResult({ userMoves, optimal, inspectionMs, executionMs });
        setPhase('solved');
        setDiffKey(k => k + 1);

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
          inspectionMs,
          executionMs,
          timestamp: new Date().toISOString(),
        };
        if (isRetryRef.current) {
          const idx = crossStats.findLastIndex(s => s.scramble === scramble);
          setCrossStats(prev => idx >= 0 ? prev.map((s, i) => i === idx ? (stat.executionMs < s.executionMs ? stat : s) : s) : [...prev, stat]);
        } else {
          setCrossStats(prev => [...prev, stat]);
        }
      }
    }
  }, [phase, kpuzzle, scramble, optimalSolutions, setCrossStats, maskAfterFirstMove, crossFace, displayRotation]);

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
    setPhase('scrambling');
    setResult(null);

    movesRef.current = [];
    setMoveCount(0);
    setGenCount(0);
    setStartTime(Date.now());
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
          <SolvedStateBadges ref={badgesRef} kpuzzle={kpuzzle} setupAlg={scramble} effectiveSolvedState={SolvedState.CROSS} displayRotation={displayRotation} movesRef={movesRef} />
        </Card>
      </Grid.Col>
      <Grid.Col span={4}>
        <Card withBorder>
          {!scramble ? (
            <Stack align="center" gap="xs" p="md">
              <Skeleton height={300} width={300} />
              <Skeleton height={20} width={200} />
              <Skeleton height={60} width="100%" />
            </Stack>
          ) : (
            <>
              <Stack align="center" gap={0}>
                <div style={{ position: 'relative' }}>
                  <SolveTimer key={startTime} ref={timerRef} autoStart={false} />
                  {showSliceWarning && (
                    <Tooltip label="A BLE notification was dropped during a slice move. The time was adjusted." withArrow>
                      <span style={{ position: 'absolute', top: 4, right: -18, lineHeight: 0 }}>
                        <TbAlertTriangle size={14} color="var(--mantine-color-gray-5)" />
                      </span>
                    </Tooltip>
                  )}
                </div>
                <CubePlayer playerRef={playerRef} setupAlg={setupAlg} showHintFacelets={showHintFacelets} />
                {(() => {
                  const optimalMoves = optimalSolutions.length > 0 ? optimalSolutions[0].moveCount : 0;
                  const optimalGen = genGroups.length > 0 ? genGroups[0].genCount : 0;
                  const curMoves = phase === 'solving' ? moveCount : (result ? result.userMoves : 0);
                  const curGen = phase === 'solving' ? genCount : (result ? genCount : 0);
                  const moveColor = curMoves > optimalMoves ? 'red' : (phase === 'solved' ? 'green' : 'dimmed');
                  const gColor = curGen > optimalGen ? 'red' : (phase === 'solved' ? 'green' : 'dimmed');
                  return (
                    <Text fz="lg" fw={700} c="dimmed">
                      <Text span c={moveColor} inherit>{curMoves} moves</Text>
                      {' ('}
                      <Text span c={gColor} inherit>{curGen}-gen</Text>
                      {')'}
                    </Text>
                  );
                })()}
              </Stack>

              <Divider label="Scramble" />

              <Box px="xs" py="xs">
                <DifferentialScramble
                  key={diffKey}
                  conn={conn}
                  kpuzzle={kpuzzle}
                  scramble={scramble}
                  phase={phase}
                  onScrambleComplete={handleScrambleComplete}
                />
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
                records={crossStats.toReversed().slice(0, 50).map((stat, index) => ({ ...stat, id: index }))}
                onRowDoubleClick={({ index }) => handleDeleteStat(crossStats.length - 1 - index)}
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
