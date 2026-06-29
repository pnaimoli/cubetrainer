import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { Grid, Card, Box, Text, Title, Group, Stack, Button, Checkbox, Tooltip, Divider, Menu, ActionIcon, rem, Modal, SegmentedControl, Chip } from '@mantine/core';
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
import { initCrossSolver, generateScrambleFromState, solveCross, CrossSolution } from '../util/crossSolver';
import { requestFacelets, computeTransitionMoves, simplifyMoves, movesToHTM } from '../util/cubeState';
import { rankCrossSolutions, RankedSolution } from '../util/crossSolutionRanker';
import { CROSS_NAMES, CROSS_CHIP_COLORS } from '../util/crossRotation';
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
  const [scrambleMoves, setScrambleMoves] = useState<string>('');
  const [optimalSolutions, setOptimalSolutions] = useState<CrossSolution[]>([]);
  const [scrambledPattern, setScrambledPattern] = useState<KPattern | null>(null);
  const [phase, setPhase] = useState<Phase>('scrambling');
  const [selectedGen, setSelectedGen] = useState<string>('');
  const [transitionMoves, setTransitionMoves] = useState<string[]>([]);
  const [computingTransition, setComputingTransition] = useState(false);
  const movesRef = useRef<Move[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [result, setResult] = useState<{ userMoves: number; optimal: number; time: number } | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [genCount, setGenCount] = useState(0);
  const [showSliceWarning, setShowSliceWarning] = useState(false);
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

  const playerRef = useRef<TwistyPlayer>(null);
  const timerRef = useRef<TimerViewHandle>(null);
  const scrambleRef = useRef<string>('');

  // Setup alg for the 3D cube (the full scramble from solved)
  const setupAlg = useMemo(() => scramble, [scramble]);

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
    setStartTime(Date.now());
  }, []);

  // Compute transition moves from current cube state to desired scramble state (retry only)
  const computeTransition = useCallback(async (targetScramble: string) => {
    if (!kpuzzle || !conn) {
      setTransitionMoves(simplifyMoves(targetScramble.split(/\s+/).filter(Boolean)));
      return;
    }

    setComputingTransition(true);
    try {
      const facelets = await requestFacelets(conn);
      const rawMoves = await computeTransitionMoves(facelets, targetScramble, kpuzzle);
      const simplified = simplifyMoves(rawMoves);
      if (scrambleRef.current === targetScramble) {
        if (simplified.length === 0) {
          handleScrambleComplete();
          return;
        }
        setTransitionMoves(simplified);
      }
    } catch (err) {
      console.warn('Failed to compute transition, using raw scramble:', err);
      if (scrambleRef.current === targetScramble) {
        setTransitionMoves(targetScramble.split(/\s+/).filter(Boolean));
      }
    } finally {
      setComputingTransition(false);
    }
  }, [kpuzzle, conn, handleScrambleComplete]);

  // Generate new scramble from solved, then compute differential from cube state
  const generateNewScramble = useCallback(() => {
    if (!kpuzzle || !solverReady) return;

    const colors = crossColorsRef.current;
    const face = colors[Math.floor(Math.random() * colors.length)];
    const { scrambleMoves: moves, targetPattern } = generateScrambleFromState(kpuzzle.defaultPattern());

    const solutions = solveCross(targetPattern, face);

    scrambleRef.current = moves;
    setScramble(moves);
    setScrambleMoves(moves);
    setOptimalSolutions(solutions);
    setScrambledPattern(targetPattern);
    setCrossFace(face);
    setPhase('scrambling');
    setResult(null);
    movesRef.current = [];
    setMoveCount(0);
    setGenCount(0);
    setStartTime(Date.now());
    setShowSliceWarning(false);
    setTransitionMoves([]);
    computeTransition(moves);
  }, [kpuzzle, solverReady, computeTransition]);

  useEffect(() => {
    if (solverReady) generateNewScramble();
  }, [solverReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply stickering mask
  useEffect(() => {
    if (!playerRef.current) return;
    playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(stickeringMask);
  }, [stickeringMask]);

  // Reset player alg on new scramble, clear blind mask
  useEffect(() => {
    if (movesRef.current.length === 0 && playerRef.current) {
      playerRef.current.alg = '';
      if (maskAfterFirstMove) {
        playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(stickeringMask);
      }
    }
  }, [startTime, maskAfterFirstMove, stickeringMask]);

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
      // Mask after first move: grey out all stickers for blind practice
      if (maskAfterFirstMove && kpuzzle && playerRef.current) {
        const blindMask = new PuzzleStickering(kpuzzle);
        const mgr = new StickeringManager(kpuzzle);
        blindMask.set(mgr.all(), PieceStickering.Ignored);
        playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(blindMask.toStickeringMask());
      }
    }

    const newMove = { move: event.move, timeOfMove };
    const newMoves = [...movesRef.current, newMove];
    movesRef.current = newMoves;
    const moveStrs = newMoves.map(m => m.move);
    setMoveCount(movesToHTM(moveStrs));
    setGenCount(new Set(moveStrs.map(m => m.charAt(0))).size);
    playerRef.current?.experimentalAddMove(event.move);

    const moveString = newMoves.map(m => m.move).join(' ');
    if (kpuzzle) {
      const currentPattern = kpuzzle.defaultPattern().applyAlg(scramble).applyAlg(moveString);
      const isSolved = isPatternSolved(currentPattern, SolvedState.CROSS, crossFace);

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
  }, [phase, kpuzzle, scramble, optimalSolutions, setCrossStats, maskAfterFirstMove, crossFace]);

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
    setPhase('scrambling');
    setResult(null);
    movesRef.current = [];
    setMoveCount(0);
    setGenCount(0);
    setStartTime(Date.now());
    setShowSliceWarning(false);
    setTransitionMoves([]);
    computeTransition(scramble);
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
    return (Math.min(...recentStats.map(s => s.timeMs)) / 1000).toFixed(3);
  };

  const getAoTime = (n: number) => {
    if (recentStats.length < n) return '-';
    const times = recentStats.slice(-n).map(s => s.timeMs);
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
      accessor: 'timeMs', title: 'Time', textAlign: 'right',
      render: (record: CrossStat) => (record.timeMs / 1000).toFixed(3),
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
        </Card>
      </Grid.Col>
      <Grid.Col span={4}>
        <Card withBorder>
          <Stack align="center" gap={0}>
            <div style={{ position: 'relative' }}>
              {phase === 'scrambling' ? (
                <Text fz="48px" fw={600} ff="monospace" c="dimmed" lh={1}>0.000</Text>
              ) : (
                <TimerView key={startTime} ref={timerRef} startTime={startTime} />
              )}
              {showSliceWarning && (
                <Tooltip label="A BLE notification was dropped during a slice move. The time was adjusted." withArrow>
                  <span style={{ position: 'absolute', top: 4, right: -18, lineHeight: 0 }}>
                    <TbAlertTriangle size={14} color="var(--mantine-color-gray-5)" />
                  </span>
                </Tooltip>
              )}
            </div>
            <CubePlayer playerRef={playerRef} setupAlg={setupAlg} showHintFacelets={showHintFacelets} />
            {result ? (
              result.userMoves === result.optimal ? (
                <Text fz="lg" fw={700} c="green">Optimal! ({result.optimal} moves, {genCount}-gen)</Text>
              ) : (
                <Text fz="lg" fw={700} c="red">
                  {result.userMoves} moves, {genCount}-gen (optimal: {result.optimal})
                </Text>
              )
            ) : (
              <Text fz="lg" fw={700} c="dimmed">
                Moves: {phase === 'solving' ? moveCount : 0} ({phase === 'solving' ? genCount : 0}-gen)
              </Text>
            )}
          </Stack>

          <Divider label="Scramble" />

          <Box px="xs" py="xs">
            <Text fz="sm" fw={700} c={CROSS_CHIP_COLORS[crossFace]} mb={2}>
              Solve: {CROSS_NAMES[crossFace]} Cross
            </Text>
            <Group gap={4} wrap="wrap">
              <Text fz="sm" ff="monospace" c="dimmed">{scrambleMoves || scramble}</Text>
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

        </Card>
      </Grid.Col>
      <Grid.Col span={4}>
        <Stack>
          <Card withBorder padding={0}>
            <Card.Section withBorder px="xs">
              <Title order={2} mt="xs" mb="xs">Stats</Title>
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
                <Title order={2}>Times</Title>
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
            <Divider label="Cross Color" />
            <Chip.Group multiple value={crossColors} onChange={(val: string[]) => {
              if (val.length > 0) setCrossColors(val);
            }}>
              <Group gap="xs">
                {(['D', 'U', 'F', 'B', 'R', 'L'] as const).map(face => (
                  <Chip key={face} value={face} color={CROSS_CHIP_COLORS[face]} size="xs">
                    {CROSS_NAMES[face]}
                  </Chip>
                ))}
              </Group>
            </Chip.Group>
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
