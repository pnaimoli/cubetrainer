import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { Grid, Card, Box, Text, Title, Group, Stack, Button, Checkbox, Tooltip, Divider, Menu, ActionIcon, rem, Modal, Chip, Skeleton, Select, RangeSlider } from '@mantine/core';
// Chip still imported for F2L slot picker
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
import { initCrossSolver } from '../util/crossSolver';
import { initXCrossSolver, solveXCross, XCrossSolution } from '../util/xcrossSolver';
import { movesToHTM } from '../util/cubeState';
import { FACE_TO_D_ROTATION, translateMove, randomRotationString } from '../util/crossRotation';
import FaceColorPicker from './FaceColorPicker';
import DifferentialScramble from './DifferentialScramble';
import SolveTimer, { SolveTimerHandle } from './SolveTimer';
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

const XCrossTrainerView: React.FC<XCrossTrainerViewProps> = ({ conn, settings }) => {
  const [kpuzzle, setKpuzzle] = useState<KPuzzle | null>(null);
  const [solverReady, setSolverReady] = useState(false);
  const [scramble, setScramble] = useState<string>('');
  const [optimalSolutions, setOptimalSolutions] = useState<XCrossSolution[]>([]);
  const [phase, setPhase] = useState<Phase>('scrambling');
  const [targetSlot, setTargetSlot] = useState<string>('');
  const [diffKey, setDiffKey] = useState(0);
  const movesRef = useRef<Move[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [result, setResult] = useState<{ userMoves: number; optimal: number; inspectionMs: number; executionMs: number } | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [showSliceWarning, setShowSliceWarning] = useState(false);
  const isRetryRef = useRef(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [solving, setSolving] = useState(false);

  const [xcrossStats, setXcrossStats] = useLocalStorage<XCrossStat[]>({ key: 'xcrossStats', defaultValue: [] });
  const [showHintFacelets, setShowHintFacelets] = useState(settings.showHintFacelets);
  const [useMaskings, setUseMaskings] = useState(settings.useMaskings);
  const [maskAfterFirstMove, setMaskAfterFirstMove] = useState(settings.maskAfterFirstMove);
  const [crossColors, setCrossColors] = useLocalStorage<string[]>({ key: 'xcrossColors', defaultValue: ['D'], getInitialValueInEffect: false });
  const crossColorsRef = useRef(crossColors);
  crossColorsRef.current = crossColors;
  const [crossFace, setCrossFace] = useState('D');
  const [randomRotationAxis, setRandomRotationAxis] = useLocalStorage<string>({ key: 'xcrossRandomRotation', defaultValue: '' });
  const randomRotationAxisRef = useRef(randomRotationAxis);
  randomRotationAxisRef.current = randomRotationAxis;
  const [extraRotation, setExtraRotation] = useState('');

  // Slot selection
  const [selectedSlots, setSelectedSlots] = useLocalStorage<string[]>({ key: 'xcrossSlots', defaultValue: ['FR', 'FL', 'BL', 'BR'], getInitialValueInEffect: false });

  // Move range filter
  const [xcrossMoveRange, setXcrossMoveRange] = useLocalStorage<[number, number]>({ key: 'xcrossMoveRange', defaultValue: [1, 10], getInitialValueInEffect: false });

  // Clear old stats that lack required fields
  useEffect(() => {
    if (xcrossStats.length > 0 && !('executionMs' in xcrossStats[0])) {
      setXcrossStats([]);
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

  // Stickering mask: highlight cross edges + target F2L pair
  const stickeringMask = useMemo(() => {
    if (!useMaskings || !kpuzzle || !scramble || !targetSlot) return null;
    const setupPattern = kpuzzle.defaultPattern().applyAlg(scramble);
    const slotState = SLOT_SOLVED_STATE[targetSlot] ?? 0;
    return generateStickeringMask(setupPattern, SolvedState.CROSS | slotState, crossFace);
  }, [useMaskings, kpuzzle, scramble, crossFace, targetSlot]);

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
    timerRef.current?.start();
  }, []);

  const generateNewScramble = useCallback(async () => {
    if (!kpuzzle || !solverReady) return;

    const colors = crossColorsRef.current;
    const face = colors[Math.floor(Math.random() * colors.length)];
    const scrambleAlg = await randomScrambleForEvent('333');
    const moves = scrambleAlg.toString();
    const targetPattern = kpuzzle.defaultPattern().applyAlg(moves);

    scrambleRef.current = moves;
    setScramble(moves);

    setCrossFace(face);
    setExtraRotation(randomRotationString(randomRotationAxisRef.current));
    isRetryRef.current = false;
    setPhase('scrambling');
    setResult(null);

    movesRef.current = [];
    setMoveCount(0);
    setStartTime(Date.now());
    setShowSliceWarning(false);
    setDiffKey(k => k + 1);
    setSolving(true);
    setOptimalSolutions([]);
    setTargetSlot('');

    // Solve XCross in a microtask so UI stays responsive
    const slotsToUse = selectedSlots.length > 0 ? selectedSlots : ['FR', 'FL', 'BL', 'BR'];
    setTimeout(() => {
      const solutions = solveXCross(targetPattern, face, slotsToUse);
      setOptimalSolutions(solutions);
      if (solutions.length > 0) {
        setTargetSlot(solutions[0].slot);
      }
      setSolving(false);
    }, 0);
  }, [kpuzzle, solverReady, selectedSlots]);

  useEffect(() => {
    if (solverReady) generateNewScramble();
  }, [solverReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply stickering mask
  useEffect(() => {
    if (!playerRef.current) return;
    playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(stickeringMask);
  }, [stickeringMask]);

  // Reset player alg on new scramble
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

  // Check if XCross is solved (cross + target F2L pair)
  const checkXCrossSolved = useCallback((currentPattern: KPattern, face: string, slot: string): boolean => {
    const slotState = SLOT_SOLVED_STATE[slot];
    if (!slotState) return false;

    // For non-D cross faces, rotate pattern into D-frame before checking F2L
    if (face !== 'D') {
      const rotation = FACE_TO_D_ROTATION[face];
      if (rotation) {
        const rotatedPattern = currentPattern.applyAlg(rotation);
        return isPatternSolved(rotatedPattern, SolvedState.CROSS | slotState, 'D');
      }
    }

    return isPatternSolved(currentPattern, SolvedState.CROSS | slotState, face);
  }, []);

  // Handle cube moves during solving
  const handleCubeMoveEvent = useCallback((event: GanCubeEvent) => {
    if (event.type !== 'MOVE') return;

    if (phase === 'solved') {
      isRetryRef.current = true;
      setPhase('scrambling');
      setResult(null);
  
      movesRef.current = [];
      setMoveCount(0);
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
    playerRef.current?.experimentalAddMove(translateMove(event.move, displayRotation));
    badgesRef.current?.notify();

    const moveString = newMoves.map(m => m.move).join(' ');
    if (kpuzzle && targetSlot) {
      const currentPattern = kpuzzle.defaultPattern().applyAlg(scramble).applyAlg(moveString);
      const isSolved = checkXCrossSolved(currentPattern, crossFace, targetSlot);

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
  }, [phase, kpuzzle, scramble, optimalSolutions, setXcrossStats, maskAfterFirstMove, crossFace, targetSlot, checkXCrossSolved, startTime, xcrossStats, displayRotation]);

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
    setStartTime(Date.now());
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

  // Filter solutions by move range, then group by slot
  const filteredSolutions = useMemo(() =>
    optimalSolutions.filter(s => s.moveCount >= xcrossMoveRange[0] && s.moveCount <= xcrossMoveRange[1]),
    [optimalSolutions, xcrossMoveRange],
  );

  const solutionsBySlot = useMemo(() => {
    const groups: Record<string, XCrossSolution[]> = {};
    for (const sol of filteredSolutions) {
      if (!groups[sol.slot]) groups[sol.slot] = [];
      groups[sol.slot].push(sol);
    }
    return groups;
  }, [filteredSolutions]);

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
          <SolvedStateBadges ref={badgesRef} kpuzzle={kpuzzle} setupAlg={scramble} effectiveSolvedState={SolvedState.CROSS | (SLOT_SOLVED_STATE[targetSlot] ?? 0)} crossFace={crossFace} movesRef={movesRef} />
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
                {solving && (
                  <Text fz="sm" c="dimmed" mb={2}>Computing solutions...</Text>
                )}
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
              {optimalSolutions.length > 0 ? (
                optimalSolutions[0].moveCount === 0 ? (
                  <Text fz="sm" c="green" fw={700}>Already solved!</Text>
                ) : filteredSolutions.length === 0 ? (
                  <Text fz="sm" c="dimmed">No solutions in {xcrossMoveRange[0]}-{xcrossMoveRange[1]} move range</Text>
                ) : (
                  <Stack gap="xs">
                    {Object.entries(solutionsBySlot).map(([slot, sols]) => (
                      <Box key={slot}>
                        <Text fz="xs" fw={700} c="dimmed" mb={2}>{slot} slot ({sols[0].moveCount} moves)</Text>
                        <Stack gap={2}>
                          {sols.slice(0, 10).map((sol, i) => (
                            <Text key={i} fz="sm" ff="monospace" c="dimmed">{sol.solution}</Text>
                          ))}
                        </Stack>
                      </Box>
                    ))}
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
            <Text fz="sm">Move range: {xcrossMoveRange[0]}-{xcrossMoveRange[1]}</Text>
            <RangeSlider
              min={1}
              max={10}
              step={1}
              value={xcrossMoveRange}
              onChange={(val) => setXcrossMoveRange(val as [number, number])}
              marks={[{ value: 1, label: '1' }, { value: 5, label: '5' }, { value: 10, label: '10' }]}
              minRange={0}
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
