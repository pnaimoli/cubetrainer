import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { Grid, Card, Box, Text, Title, Group, Stack, Button, Checkbox, Collapse, Divider, Menu, ActionIcon, rem, Modal } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { mkConfig, generateCsv, download } from 'export-to-csv';
import { TbArrowRight, TbRefresh, TbEye, TbEyeOff, TbDots, TbTrash, TbDownload, TbReport, TbArrowLeft } from 'react-icons/tb';
import { KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

import { CTAlg } from '../util/CTAlg';
import { Settings, SolvedState, Move } from '../util/interfaces';
import { FACE_TO_D_ROTATION } from '../util/crossRotation';
import { isPatternSolved } from '../util/SolveChecker';
import { generateStickeringMask } from '../util/StickeringMask';
import { F2L_DB, OLL_DB } from '../util/algDatabase';
import SettingsView from './SettingsView';
import CubeTimerPlayer, { CubeTimerPlayerHandle } from './CubeTimerPlayer';
import { SolvedStateBadges, SolvedStateBadgesHandle } from './TrainerView';

interface OLLPredictionStat {
  f2lCase: string;
  ollCase: string;
  attempts: number;
  correct: boolean;
  timestamp: string;
}

const OLL_STATS_KEY = 'ollPredictionStats';
const OLL_STATS_BACKUP_KEY = 'ollPredictionStats_v1';

interface OLLPredictionViewProps {
  conn: GanCubeConnection | null;
  settings: Settings;
}

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
  if (!mirrorAcrossM) return false;
  if (randomizeMirrorAcrossM) return Math.random() < 0.5;
  return true;
};

const recomputeMirrorAcrossS = (mirrorAcrossS: boolean, randomizeMirrorAcrossS: boolean): boolean => {
  if (!mirrorAcrossS) return false;
  if (randomizeMirrorAcrossS) return Math.random() < 0.5;
  return true;
};

function migrateOldStats(oldStats: unknown[]): OLLPredictionStat[] {
  // Old format: { f2lCase, ollCase, correct, timestamp } without attempts field
  // Group consecutive entries with same f2lCase+ollCase.
  // correct: false entries are failed attempts. If followed by correct: true, record as solved with N+1 attempts.
  // Otherwise DNF.
  interface OldStat { f2lCase: string; ollCase: string; correct: boolean; timestamp: string; }
  const stats = oldStats as OldStat[];
  const result: OLLPredictionStat[] = [];

  let i = 0;
  while (i < stats.length) {
    const s = stats[i];
    let attempts = 1;

    if (s.correct) {
      // Standalone success
      result.push({ f2lCase: s.f2lCase, ollCase: s.ollCase, attempts: 1, correct: true, timestamp: s.timestamp });
      i++;
    } else {
      // Count consecutive failures for same case
      let failCount = 0;
      while (i < stats.length && !stats[i].correct && stats[i].f2lCase === s.f2lCase && stats[i].ollCase === s.ollCase) {
        failCount++;
        i++;
      }
      // Check if followed by a success for same case
      if (i < stats.length && stats[i].correct && stats[i].f2lCase === s.f2lCase && stats[i].ollCase === s.ollCase) {
        attempts = failCount + 1;
        result.push({ f2lCase: s.f2lCase, ollCase: s.ollCase, attempts, correct: true, timestamp: stats[i].timestamp });
        i++;
      } else {
        // DNF
        result.push({ f2lCase: s.f2lCase, ollCase: s.ollCase, attempts: failCount, correct: false, timestamp: s.timestamp });
      }
    }
  }
  return result;
}

const ALGSET_NAME = 'OLL Prediction';
const F2L_CASES_KEY = 'ollPrediction_selectedF2L';
const OLL_CASES_KEY = 'ollPrediction_selectedOLL';

///////////////////////////////////////////////////////////////////////////////
// Reports View
///////////////////////////////////////////////////////////////////////////////
const OLLPredictionReportsView: React.FC<{ stats: OLLPredictionStat[]; onBack: () => void }> = ({ stats, onBack }) => {
  const total = stats.length;
  const correct = stats.filter(s => s.correct).length;
  const overallAccuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : '0';

  // Group by OLL case
  const ollBreakdown = useMemo(() => {
    const map = new Map<string, { correct: number; total: number; totalAttempts: number }>();
    for (const s of stats) {
      const entry = map.get(s.ollCase) ?? { correct: 0, total: 0, totalAttempts: 0 };
      entry.total++;
      entry.totalAttempts += s.attempts;
      if (s.correct) entry.correct++;
      map.set(s.ollCase, entry);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [stats]);

  return (
    <Grid>
      <Grid.Col span={12}>
        <Card withBorder>
          <Card.Section withBorder px="xs" py="xs">
            <Group justify="space-between">
              <Title order={3}>OLL Prediction Reports</Title>
              <Button variant="outline" size="xs" onClick={onBack} leftSection={<TbArrowLeft />}>Back</Button>
            </Group>
          </Card.Section>
          <Stack gap="xs" p="xs">
            <Text fz="sm" fw={700}>Overall Accuracy: {overallAccuracy}% ({correct}/{total})</Text>
            <Divider label="By OLL Case" />
            <Stack gap={2} style={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto' }}>
              {ollBreakdown.map(([ollCase, data]) => (
                <Group key={ollCase} justify="space-between" gap="xs">
                  <Text fz="xs" ff="monospace" style={{ minWidth: 80 }}>OLL-{ollCase}</Text>
                  <Text fz="xs" ff="monospace">
                    {data.total > 0 ? ((data.correct / data.total) * 100).toFixed(0) : 0}% ({data.correct}/{data.total})
                  </Text>
                  <Text fz="xs" ff="monospace" c="dimmed">
                    avg {data.total > 0 ? (data.totalAttempts / data.total).toFixed(1) : '-'} tries
                  </Text>
                </Group>
              ))}
            </Stack>
          </Stack>
        </Card>
      </Grid.Col>
    </Grid>
  );
};

///////////////////////////////////////////////////////////////////////////////
// Main View
///////////////////////////////////////////////////////////////////////////////
const OLLPredictionView: React.FC<OLLPredictionViewProps> = ({ conn, settings }) => {
  const [kpuzzle, setKpuzzle] = useState<KPuzzle | null>(null);
  const [selectedF2L, setSelectedF2L] = useLocalStorage<number[]>({
    key: F2L_CASES_KEY,
    defaultValue: F2L_DB.map((_, i) => i),
    getInitialValueInEffect: false,
  });
  const [selectedOLL, setSelectedOLL] = useLocalStorage<number[]>({
    key: OLL_CASES_KEY,
    defaultValue: OLL_DB.map((_, i) => i),
    getInitialValueInEffect: false,
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
  const consecutiveDRef = useRef<string[]>([]);
  const attemptsRef = useRef(1);
  const [caseKey, setCaseKey] = useState(0);
  const [localSettings] = useLocalStorage<Settings>({ key: 'settings', defaultValue: settings, getInitialValueInEffect: false });
  const [preorientationResult, setPreorientationResult] = useState(() => recomputePreorientationMoves(localSettings.crossFaces, localSettings.randomRotations1));
  const preorientationMoves = preorientationResult.moves;
  const [randomPreUs, setRandomPreUs] = useState<number>(recomputeRandomUs(localSettings.randomPreAUF));
  const [randomUs, setRandomUs] = useState<number>(recomputeRandomUs(localSettings.randomAUF));
  const [randomYs, setRandomYs] = useState<number>(recomputeRandomYs(localSettings.randomYs));
  const [mirrorAcrossM, setMirrorAcrossM] = useState<boolean>(recomputeMirrorAcrossM(localSettings.mirrorAcrossM, localSettings.randomizeMirrorAcrossM));
  const [mirrorAcrossS, setMirrorAcrossS] = useState<boolean>(recomputeMirrorAcrossS(localSettings.mirrorAcrossS, localSettings.randomizeMirrorAcrossS));
  const [caseHidden, setCaseHidden] = useState<boolean>(false);
  const [showReports, setShowReports] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const [ollStats, setOllStats] = useLocalStorage<OLLPredictionStat[]>({ key: OLL_STATS_KEY, defaultValue: [], getInitialValueInEffect: false });

  // One-time migration from old format (lacks attempts field)
  useEffect(() => {
    if (ollStats.length > 0 && !('attempts' in ollStats[0])) {
      // Back up old stats
      localStorage.setItem(OLL_STATS_BACKUP_KEY, JSON.stringify(ollStats));
      // Migrate
      const migrated = migrateOldStats(ollStats);
      setOllStats(migrated);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cubeTimerRef = useRef<CubeTimerPlayerHandle>(null);
  const badgesRef = useRef<SolvedStateBadgesHandle>(null);
  const postSolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSettingsRef = useRef(localSettings);

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

  useEffect(() => {
    return () => {
      if (postSolveTimeoutRef.current) clearTimeout(postSolveTimeoutRef.current);
    };
  }, []);

  const advanceToNext = useCallback(() => {
    setCurrentF2LIndex(selectedF2L.length > 0 ? pickRandom(selectedF2L) : 0);
    setCurrentOLLIndex(selectedOLL.length > 0 ? pickRandom(selectedOLL) : 0);
    setPreorientationResult(recomputePreorientationMoves(localSettings.crossFaces, localSettings.randomRotations1));
    setRandomPreUs(recomputeRandomUs(localSettings.randomPreAUF));
    setRandomUs(recomputeRandomUs(localSettings.randomAUF));
    setRandomYs(recomputeRandomYs(localSettings.randomYs));
    setMirrorAcrossM(recomputeMirrorAcrossM(localSettings.mirrorAcrossM, localSettings.randomizeMirrorAcrossM));
    setMirrorAcrossS(recomputeMirrorAcrossS(localSettings.mirrorAcrossS, localSettings.randomizeMirrorAcrossS));
    movesRef.current = [];
    attemptsRef.current = 1;
    setCaseKey(k => k + 1);
  }, [selectedF2L, selectedOLL, localSettings]);

  const recordStat = useCallback((correct: boolean, attempts: number) => {
    setOllStats(prev => [...prev, {
      f2lCase: currentF2L.name,
      ollCase: currentOLL.name,
      attempts,
      correct,
      timestamp: new Date().toISOString(),
    }]);
  }, [currentF2L, currentOLL, setOllStats]);

  const handleCubeMoveEvent = useCallback((event: GanCubeEvent) => {
    if (event.type !== 'MOVE') return;

    // D4 / D4' shortcuts: track consecutive D or D' across all phases
    const move = event.move;
    if (move === 'D' || move === "D'") {
      const prev = consecutiveDRef.current;
      if (prev.length === 0 || prev[0] === move) {
        consecutiveDRef.current = [...prev, move];
      } else {
        consecutiveDRef.current = [move];
      }
      if (consecutiveDRef.current.length >= 4) {
        consecutiveDRef.current = [];
        if (move === 'D') {
          // Next/skip
          if (movesRef.current.length > 0 || attemptsRef.current > 1) {
            recordStat(false, attemptsRef.current);
          }
          advanceToNext();
        } else {
          // Retry
          attemptsRef.current++;
          movesRef.current = [];
          setCaseKey(k => k + 1);
        }
        return;
      }
    } else {
      consecutiveDRef.current = [];
    }

    const OPPOSITE_FACES: Record<string, string> = { L:'R', R:'L', F:'B', B:'F', U:'D', D:'U' };
    const now = Date.now();
    const cubeTs = event.cubeTimestamp ?? null;

    const prevMoves = movesRef.current;
    const moveFace = move.charAt(0);
    const isSliceRecovery = cubeTs === null
      && prevMoves.length > 0
      && OPPOSITE_FACES[prevMoves[prevMoves.length - 1].move.charAt(0)] === moveFace;

    const timeOfMove = isSliceRecovery ? prevMoves[prevMoves.length - 1].timeOfMove : now;

    if (movesRef.current.length === 0) {
      cubeTimerRef.current?.firstMove(timeOfMove);
    }

    const newMove = { move, timeOfMove };
    const newMoves = [...movesRef.current, newMove];
    movesRef.current = newMoves;
    cubeTimerRef.current?.addMove(move);

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

    cubeTimerRef.current?.stopAt(timeOfMove);
    recordStat(true, attemptsRef.current);

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

  // Re-randomize only when the user actually changes a setting mid-session.
  // Comparing against previous values avoids re-rolling on mount/StrictMode re-mount.
  useEffect(() => {
    const prev = prevSettingsRef.current;
    prevSettingsRef.current = localSettings;
    if (prev.randomPreAUF !== localSettings.randomPreAUF)
      setRandomPreUs(recomputeRandomUs(localSettings.randomPreAUF));
    if (prev.randomAUF !== localSettings.randomAUF)
      setRandomUs(recomputeRandomUs(localSettings.randomAUF));
    if (prev.randomYs !== localSettings.randomYs)
      setRandomYs(recomputeRandomYs(localSettings.randomYs));
    if ((prev.crossFaces ?? []).join() !== (localSettings.crossFaces ?? []).join() || prev.randomRotations1 !== localSettings.randomRotations1)
      setPreorientationResult(recomputePreorientationMoves(localSettings.crossFaces, localSettings.randomRotations1));
    if (prev.mirrorAcrossM !== localSettings.mirrorAcrossM || prev.randomizeMirrorAcrossM !== localSettings.randomizeMirrorAcrossM)
      setMirrorAcrossM(recomputeMirrorAcrossM(localSettings.mirrorAcrossM, localSettings.randomizeMirrorAcrossM));
    if (prev.mirrorAcrossS !== localSettings.mirrorAcrossS || prev.randomizeMirrorAcrossS !== localSettings.randomizeMirrorAcrossS)
      setMirrorAcrossS(recomputeMirrorAcrossS(localSettings.mirrorAcrossS, localSettings.randomizeMirrorAcrossS));
  });

  const handleRestart = () => {
    attemptsRef.current++;
    movesRef.current = [];
    setCaseKey(k => k + 1);
  };

  const handleNext = () => {
    if (movesRef.current.length > 0 || attemptsRef.current > 1) {
      recordStat(false, attemptsRef.current);
    }
    advanceToNext();
  };

  const handleExportData = () => {
    const formatTimestamp = (date: Date) => {
      const pad = (num: number) => (num < 10 ? '0' : '') + num;
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    };
    const timestamp = formatTimestamp(new Date());
    const csvConfig = mkConfig({
      filename: `oll-prediction-stats-${timestamp}`,
      useKeysAsHeaders: true,
      showColumnHeaders: true,
    });
    const csv = generateCsv(csvConfig)(ollStats as unknown as Record<string, string | number>[]);
    download(csvConfig)(csv);
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

  // Summary stats
  const totalStats = ollStats.length;
  const correctStats = ollStats.filter(s => s.correct).length;
  const accuracyPct = totalStats > 0 ? ((correctStats / totalStats) * 100).toFixed(0) : '-';
  const last50 = ollStats.slice(-50);
  const last50Correct = last50.filter(s => s.correct).length;
  const ao50Accuracy = last50.length > 0 ? ((last50Correct / last50.length) * 100).toFixed(0) : '-';

  if (showReports) {
    return <OLLPredictionReportsView stats={ollStats} onBack={() => setShowReports(false)} />;
  }

  return (
    <Grid>
      <Grid.Col span={12}>
        <Card withBorder padding={0}>
          <Card.Section withBorder px="xs" py="xs">
            <Group justify="space-between" wrap="wrap">
              <Title style={{ fontSize: 'clamp(1.25rem, 7vw, var(--mantine-h1-font-size))', whiteSpace: 'nowrap' }}>{ALGSET_NAME}</Title>
              <Group>
                <Button variant="outline" size="xs" onClick={handleRestart} leftSection={<TbRefresh />}>
                  Retry [D4']
                </Button>
                <Button variant="outline" size="xs" onClick={handleNext} leftSection={<TbArrowRight />}>
                  Next [D4]
                </Button>
              </Group>
            </Group>
          </Card.Section>
          <SolvedStateBadges ref={badgesRef} kpuzzle={kpuzzle} setupAlg={setupAlg} effectiveSolvedState={effectiveSolvedState} movesRef={movesRef} />
        </Card>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Card withBorder>
          <Card.Section withBorder px="xs">
            <Title order={2} style={{ cursor: 'pointer' }} onClick={() => setCaseHidden(h => !h)}>
              Case {caseHidden
                ? <TbEyeOff style={{ verticalAlign: 'middle' }} />
                : <TbEye style={{ verticalAlign: 'middle' }} />
              }: {caseHidden ? '???' : `F2L-${currentF2L.name} + OLL-${currentOLL.name}`}
            </Title>
          </Card.Section>
          <CubeTimerPlayer
            ref={cubeTimerRef}
            setupAlg={setupAlg}
            showHintFacelets={localSettings.showHintFacelets}
            stickeringMask={stickeringMask}
            kpuzzle={kpuzzle}
            maskAfterFirstMove={localSettings.maskAfterFirstMove}
            caseKey={caseKey}
          />
        </Card>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Card withBorder>
          <Card.Section withBorder px="xs">
            <Group justify="space-between">
              <Title order={2} mt="xs" mb="xs">Results</Title>
              <Menu withinPortal position="bottom-end" shadow="sm">
                <Menu.Target>
                  <ActionIcon variant="subtle" color="gray">
                    <TbDots style={{ width: rem(16), height: rem(16) }} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
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
                    Clear stats
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Card.Section>
          <Stack gap="xs" p="xs">
            <Text fz="sm" fw={700} ff="monospace">
              total {totalStats} | accuracy {accuracyPct}% | ao50 {ao50Accuracy}%
            </Text>
            <Divider />
            <Stack gap={2} style={{ maxHeight: 'calc(100vh - 360px)', overflow: 'auto' }}>
              {[...ollStats].reverse().map((stat, i) => (
                <Group key={i} justify="space-between" gap="xs">
                  <Text fz="xs" ff="monospace">F2L-{stat.f2lCase} + OLL-{stat.ollCase}</Text>
                  <Group gap={4}>
                    {stat.attempts > 1 && (
                      <Text fz="xs" ff="monospace" c="dimmed">{stat.attempts} tries</Text>
                    )}
                    <Text fz="xs" fw={700} c={stat.correct ? 'green' : 'red'}>
                      {stat.correct ? 'OK' : 'DNF'}
                    </Text>
                  </Group>
                </Group>
              ))}
            </Stack>
          </Stack>
        </Card>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 4 }}>
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
      <Modal opened={confirmDeleteAll} onClose={() => setConfirmDeleteAll(false)} title="Clear Stats" centered>
        <Text mb="md">Are you sure you want to clear all OLL prediction stats? This can't be undone.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmDeleteAll(false)}>Cancel</Button>
          <Button color="red" onClick={() => { setOllStats([]); setConfirmDeleteAll(false); }}>Clear All</Button>
        </Group>
      </Modal>
    </Grid>
  );
};

export default OLLPredictionView;
