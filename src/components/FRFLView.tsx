import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { Grid, Card, Box, Text, Title, Group, Stack, Button, Checkbox, Collapse, Divider } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { TbArrowRight, TbRefresh, TbEye, TbEyeOff } from 'react-icons/tb';
import { KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

import { CTAlg } from '../util/CTAlg';
import { Settings, Alg, SolvedState, SolveStat, Move, ValidMove } from '../util/interfaces';
import { FACE_TO_D_ROTATION } from '../util/crossRotation';
import { isPatternSolved } from '../util/SolveChecker';
import { generateStickeringMask } from '../util/StickeringMask';
import { F2L_DB } from '../util/algDatabase';
import { generateOneFRFL } from '../util/f2lGenerator';
import SettingsView from './SettingsView';
import CubeTimerPlayer, { CubeTimerPlayerHandle } from './CubeTimerPlayer';
import SummaryStatsView from './SummaryStatsView';
import TimesListView from './TimesListView';
import { SolvedStateBadges, SolvedStateBadgesHandle } from './TrainerView';

interface FRFLViewProps {
  conn: GanCubeConnection | null;
  settings: Settings;
}

const ALGSET_ID = 'minigame-frfl';
const ALGSET_NAME = 'FR+FL Slot Game';

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

function generateAlg(selectedFL: number[], selectedFR: number[]): Alg {
  const flEntries = selectedFL.length > 0 ? selectedFL.map(i => F2L_DB[i]) : [F2L_DB[0]];
  const frEntries = selectedFR.length > 0 ? selectedFR.map(i => F2L_DB[i]) : [F2L_DB[0]];
  const { name, alg } = generateOneFRFL(flEntries, frEntries);
  return { name, alg: alg.split(/\s+/) as ValidMove[], solved: SolvedState.F2L };
}

const F2LSlotSelector: React.FC<{ label: string; selected: number[]; setSelected: (s: number[]) => void }> = ({ label, selected, setSelected }) => {
  const [show, setShow] = useState(false);

  const toggleCase = (index: number) => {
    if (selected.includes(index)) {
      if (selected.length <= 1) return;
      setSelected(selected.filter(i => i !== index));
    } else {
      setSelected([...selected, index]);
    }
  };

  return (
    <>
      <Divider label={label} />
      <Group gap="xs">
        <Button size="xs" variant="subtle" onClick={() => setSelected(F2L_DB.map((_, i) => i))}>All</Button>
        <Button size="xs" variant="subtle" onClick={() => setSelected([0])}>None</Button>
        <Button size="xs" variant="subtle" onClick={() => setShow(s => !s)}>
          {show ? 'Hide' : 'Show'} ({selected.length}/{F2L_DB.length})
        </Button>
      </Group>
      <Collapse in={show}>
        <Stack gap={2}>
          {F2L_DB.map((entry, i) => (
            <Checkbox
              key={i}
              label={`${entry.name}: ${entry.alg}`}
              checked={selected.includes(i)}
              onChange={() => toggleCase(i)}
              size="xs"
              styles={{ label: { fontFamily: 'monospace', fontSize: '0.7rem' } }}
            />
          ))}
        </Stack>
      </Collapse>
    </>
  );
};

const FRFLView: React.FC<FRFLViewProps> = ({ conn, settings }) => {
  const [kpuzzle, setKpuzzle] = useState<KPuzzle | null>(null);
  const [selectedFL, setSelectedFL] = useLocalStorage<number[]>({
    key: 'frfl_selectedFL',
    defaultValue: F2L_DB.map((_, i) => i),
    getInitialValueInEffect: false,
  });
  const [selectedFR, setSelectedFR] = useLocalStorage<number[]>({
    key: 'frfl_selectedFR',
    defaultValue: F2L_DB.map((_, i) => i),
    getInitialValueInEffect: false,
  });

  const [currentAlg, setCurrentAlg] = useState<Alg>(() => generateAlg(selectedFL, selectedFR));
  const movesRef = useRef<Move[]>([]);
  const [caseKey, setCaseKey] = useState(0);
  const [preorientationResult, setPreorientationResult] = useState(() => recomputePreorientationMoves(settings.crossFaces, settings.randomRotations1));
  const preorientationMoves = preorientationResult.moves;
  const [randomPreUs, setRandomPreUs] = useState<number>(recomputeRandomUs(settings.randomPreAUF));
  const [randomUs, setRandomUs] = useState<number>(recomputeRandomUs(settings.randomAUF));
  const [randomYs, setRandomYs] = useState<number>(recomputeRandomYs(settings.randomYs));
  const [mirrorAcrossM, setMirrorAcrossM] = useState<boolean>(recomputeMirrorAcrossM(settings.mirrorAcrossM, settings.randomizeMirrorAcrossM));
  const [mirrorAcrossS, setMirrorAcrossS] = useState<boolean>(recomputeMirrorAcrossS(settings.mirrorAcrossS, settings.randomizeMirrorAcrossS));
  const [caseHidden, setCaseHidden] = useState<boolean>(false);

  const [, setStats] = useLocalStorage<{ [key: string]: SolveStat[] }>({ key: 'stats', defaultValue: {}, getInitialValueInEffect: false });

  const cubeTimerRef = useRef<CubeTimerPlayerHandle>(null);
  const badgesRef = useRef<SolvedStateBadgesHandle>(null);
  const postSolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const solvedRef = useRef(false);
  const prevSettingsRef = useRef(settings);

  const setupAlg = useMemo(() => {
    let algString = currentAlg.alg.join(' ');

    if (mirrorAcrossM)
      algString = (new CTAlg(algString)).mirror().toString();
    if (mirrorAcrossS)
      algString = (new CTAlg(algString)).mirrorOverS().toString();

    const inverseAlg = (new CTAlg(algString)).invert().toString();

    const preorientationString = preorientationMoves.map(move => move.move).join(' ');

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

    return `${preorientationString} ${preMoves} ${inverseAlg} ${postMoves}`.replace(/\s+/g, ' ').trim();
  }, [currentAlg, preorientationMoves, randomPreUs, randomUs, randomYs, mirrorAcrossM, mirrorAcrossS]);

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

    let state: number = currentAlg.solved ?? SolvedState.FULL;
    if (mirrorAcrossM) state = mapSolvedState(state, MIRROR_ACROSS_M_MAPPING);
    if (mirrorAcrossS) state = mapSolvedState(state, MIRROR_ACROSS_S_MAPPING);
    if (randomYs > 0) {
      for (let i = 0; i < randomYs; ++i)
        state = mapSolvedState(state, Y_ROTATION_MAPPING);
    }
    return state;
  }, [currentAlg, randomYs, mirrorAcrossM, mirrorAcrossS]);

  const stickeringMask = useMemo(() => {
    if (!settings.useMaskings || !kpuzzle) return null;
    const setupPattern = kpuzzle.defaultPattern().applyAlg(setupAlg);
    return generateStickeringMask(setupPattern, effectiveSolvedState);
  }, [settings.useMaskings, kpuzzle, setupAlg, effectiveSolvedState]);

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
    setCurrentAlg(generateAlg(selectedFL, selectedFR));
    setPreorientationResult(recomputePreorientationMoves(settings.crossFaces, settings.randomRotations1));
    setRandomPreUs(recomputeRandomUs(settings.randomPreAUF));
    setRandomUs(recomputeRandomUs(settings.randomAUF));
    setRandomYs(recomputeRandomYs(settings.randomYs));
    setMirrorAcrossM(recomputeMirrorAcrossM(settings.mirrorAcrossM, settings.randomizeMirrorAcrossM));
    setMirrorAcrossS(recomputeMirrorAcrossS(settings.mirrorAcrossS, settings.randomizeMirrorAcrossS));
    movesRef.current = [];
    solvedRef.current = false;
    setCaseKey(k => k + 1);
  }, [selectedFL, selectedFR, settings]);

  const handleCubeMoveEvent = useCallback((event: GanCubeEvent) => {
    if (event.type !== 'MOVE' || solvedRef.current) return;

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
      cubeTimerRef.current?.firstMove(timeOfMove);
    }

    const newMove = { move: event.move, timeOfMove };
    const newMoves = [...movesRef.current, newMove];
    movesRef.current = newMoves;
    cubeTimerRef.current?.addMove(event.move);

    // D4 / D4' retry shortcut
    if (newMoves.length >= 4) {
      const last4 = newMoves.slice(-4).map(m => m.move);
      if (last4.every(m => m === 'D') || last4.every(m => m === "D'")) {
        movesRef.current = [];
        solvedRef.current = false;
        setCaseKey(k => k + 1);
        return;
      }
    }

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

    solvedRef.current = true;

    const newSolveStat: SolveStat = {
      name: currentAlg.name,
      timeOfSolve: new Date().toISOString(),
      moves: newMoves,
      executionTime: newMoves[newMoves.length-1].timeOfMove - newMoves[0].timeOfMove,
      recognitionTime: newMoves[0].timeOfMove - (cubeTimerRef.current?.getStartTime() ?? 0),
      preAUFs: randomPreUs,
      AUFs: randomUs,
      Ys: randomYs,
      mirroredOverM: mirrorAcrossM,
      mirroredOverS: mirrorAcrossS,
      preorientationMoves: preorientationMoves.map(m => m.move),
    };

    cubeTimerRef.current?.stop();

    // Defer stats write to avoid blocking the UI on the final move.
    // localStorage serialization + cross-component event dispatch is heavy.
    setTimeout(() => {
      setStats(prevStats => ({
        ...prevStats,
        [ALGSET_ID]: [
          ...(prevStats[ALGSET_ID] || []),
          newSolveStat
        ]
      }));
    }, 0);

    const delay = settings.postSolveDelay * 1000;
    if (delay > 0) {
      postSolveTimeoutRef.current = setTimeout(advanceToNext, delay);
    } else {
      advanceToNext();
    }
  }, [currentAlg, setupAlg, effectiveSolvedState, kpuzzle, mirrorAcrossM, mirrorAcrossS,
      randomPreUs, randomUs, randomYs, settings, preorientationMoves, setStats, advanceToNext]);

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
    prevSettingsRef.current = settings;
    if (prev.randomPreAUF !== settings.randomPreAUF)
      setRandomPreUs(recomputeRandomUs(settings.randomPreAUF));
    if (prev.randomAUF !== settings.randomAUF)
      setRandomUs(recomputeRandomUs(settings.randomAUF));
    if (prev.randomYs !== settings.randomYs)
      setRandomYs(recomputeRandomYs(settings.randomYs));
    if (prev.crossFaces.join() !== settings.crossFaces.join() || prev.randomRotations1 !== settings.randomRotations1)
      setPreorientationResult(recomputePreorientationMoves(settings.crossFaces, settings.randomRotations1));
    if (prev.mirrorAcrossM !== settings.mirrorAcrossM || prev.randomizeMirrorAcrossM !== settings.randomizeMirrorAcrossM)
      setMirrorAcrossM(recomputeMirrorAcrossM(settings.mirrorAcrossM, settings.randomizeMirrorAcrossM));
    if (prev.mirrorAcrossS !== settings.mirrorAcrossS || prev.randomizeMirrorAcrossS !== settings.randomizeMirrorAcrossS)
      setMirrorAcrossS(recomputeMirrorAcrossS(settings.mirrorAcrossS, settings.randomizeMirrorAcrossS));
  });

  const handleRestart = () => {
    movesRef.current = [];
    solvedRef.current = false;
    setCaseKey(k => k + 1);
  };

  const handleNext = () => {
    advanceToNext();
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
                  Retry [D4]
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
              }: {caseHidden ? '???' : currentAlg.name}
            </Title>
          </Card.Section>
          <Card.Section withBorder px="xs">
            <Text>{currentAlg.alg.join(' ')}</Text>
          </Card.Section>
          <CubeTimerPlayer
            ref={cubeTimerRef}
            setupAlg={setupAlg}
            showHintFacelets={settings.showHintFacelets}
            stickeringMask={stickeringMask}
            kpuzzle={kpuzzle}
            maskAfterFirstMove={settings.maskAfterFirstMove}
            caseKey={caseKey}
          />
        </Card>
      </Grid.Col>
      <Grid.Col span={4}>
        <Stack>
          <SummaryStatsView algSetId={ALGSET_ID} />
          <TimesListView algSetId={ALGSET_ID} algSetName={ALGSET_NAME} maxHeight="calc(100vh - 360px)" />
        </Stack>
      </Grid.Col>
      <Grid.Col span={4}>
        <Card withBorder>
          <Card.Section withBorder px="xs">
            <Title order={2}>Settings</Title>
          </Card.Section>
          <Box pt="xs">
            <SettingsView disableAlgSelection />
          </Box>
          <Stack gap="xs" p="xs">
            <F2LSlotSelector label="FL Case Selection (1st)" selected={selectedFL} setSelected={setSelectedFL} />
            <F2LSlotSelector label="FR Case Selection (2nd)" selected={selectedFR} setSelected={setSelectedFR} />
          </Stack>
        </Card>
      </Grid.Col>
    </Grid>
  );
};

export default FRFLView;
