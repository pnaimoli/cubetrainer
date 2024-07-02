import React, { useReducer, useEffect, useRef } from 'react';
import { GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { Grid, Card, Skeleton, Text, Badge, Title, Center, Group, Stack } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import 'cubing/twisty';
import { TwistyPlayer } from 'cubing/twisty';
import { KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

import { CTAlg } from '../util/CTAlg';
import { AlgSet, Alg as Algorithm, SolvedState, CUBE_ROTATIONS, SolveStat } from '../util/interfaces';
import { isPatternSolved } from '../util/SolveChecker';
import { generateStickeringMask } from '../util/StickeringMask';
import { SummaryStatsView, TimesListView } from './StatsViews';
import TimerView from './TimerView';
import styles from './TrainerView.module.css'

interface TrainerViewProps {
  currentAlgSet: AlgSet;
  conn: GanCubeConnection | null;
  settings: Settings;
  initialAlg?: Algorithm;
}

const TrainerView: React.FC<TrainerViewProps> = ({ currentAlgSet, conn, settings, initialAlg }) => {
  /////////////////////////////////////////////////////////////////////////////
  // State initialization
  /////////////////////////////////////////////////////////////////////////////
  interface Move {
    move: string;
    timeOfMove: number;
  }

  interface State {
    kpuzzle: KPuzzle | null;
    currentAlg: Algorithm | null;
    solvedStateMap: Record<string, boolean>;
    moves: Move[];

    startTime: number,
    sessionStats: SolveStat[],

    setupAlg: string;
    effectiveSolvedState: SolvedState;
    stickeringMask: StickeringMask,
    randomUs: number;
    randomYs: number;
    randomRotations: number;
    mirrorAcrossM: boolean;
    mirrorAcrossS: boolean;
  }

  const initialState: State = {
    kpuzzle: null,
    currentAlg:  null,
    solvedStateMap: {},
    moves: [],

    startTime: 0,
    sessionStats: [],

    setupAlg: "",
    effectiveSolvedState: SolvedState.FULL,
    stickeringMask: { },
    randomUs: 0,
    randomYs: 0,
    randomRotations: 0,
    mirrorAcrossM: false,
    mirrorAcrossS: false
  };

  const initializeState = (initialAlg: Algorithm | undefined, currentAlgSet: AlgSet, settings: Settings): State => {
    let currentAlg: Algorithm | null = null;

    if (initialAlg) {
      currentAlg = initialAlg;
    } else if (settings.playlistMode === 'ordered') {
      currentAlg = currentAlgSet.algs[0];
    } else {
      const randomIndex = Math.floor(Math.random() * currentAlgSet.algs.length);
      currentAlg = currentAlgSet.algs[randomIndex];
    }

    return setCurrentAlg(initialState, currentAlg);
  };

  /////////////////////////////////////////////////////////////////////////////
  // This is the heavy lifting
  /////////////////////////////////////////////////////////////////////////////
  type Action =
      { type: 'ADD_MOVE'; payload: string }
    | { type: 'SET_KPUZZLE'; payload: KPuzzle }
    | { type: 'SET_CURRENT_ALG'; payload: Algorithm }
    | { type: 'RECOMPUTE_RANDOM_AUF'; }
    | { type: 'RECOMPUTE_RANDOM_YS'; }
    | { type: 'RECOMPUTE_PREORIENTATION'; }
    | { type: 'RECOMPUTE_MIRROR_ACROSS_M'; }
    | { type: 'RECOMPUTE_MIRROR_ACROSS_S'; };

  const recomputeSetup = (state: State): State => {
    // First compute what the inverse of our alg needs to be,
    // subject to potentially mirroring across a couple axes
    let algString = state.currentAlg.alg.join(' ');
    let ctAlg = new CTAlg(algString);

    if (state.mirrorAcrossM) {
      algString = ctAlg.mirror().toString();
    }

    ctAlg = new CTAlg(algString);

    if (state.mirrorAcrossS) {
      algString = ctAlg.mirrorOverS().toString();
    }

    const parsedAlg = CTAlg.fromString(algString);
    const inverseAlg = parsedAlg.invert().toString();

    // Next, compute preorientation
    let preorientation = '';
    if (settings.fullColourNeutrality) {
      let rotations = '';
      for (let i = 0; i < 6; i++) {
        const randomRotation = CUBE_ROTATIONS[Math.floor(Math.random() * CUBE_ROTATIONS.length)];
        rotations += ` ${randomRotation}`;
      }
      preorientation = rotations;
    } else {
      if (settings.firstRotation) {
        preorientation += ` ${settings.firstRotation}`;
      }
      if (state.randomRotations === 0) {
      } else if (state.randomRotations === 1) {
        preorientation += ` ${settings.randomRotations1}`;
      } else {
        preorientation += ` ${settings.randomRotations1}${state.randomRotations}`;
      }
    }

    let postMoves = '';
    if (state.randomUs === 0) {
    } else if (state.randomUs === 1) {
      postMoves += ' U';
    } else {
      postMoves += ` U${state.randomUs}`;
    }
    if (state.randomYs === 0) {
    } else if (state.randomYs === 1) {
      postMoves += ' y';
    } else {
      postMoves += ` y${state.randomYs}`;
    }

    const finalSetupAlg = `${preorientation} ${inverseAlg} ${postMoves}`.trim();
    // TODO: replace duplicate whitespace

    // We also need to recompute our effectiveSolvedState and stickeringMask
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

      for (const [originalState, mirroredStateValue] of Object.entries(mapping)) {
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

    let effectiveSolvedState = state.currentAlg.solved ?? SolvedState.FULL;
    if (state.mirrorAcrossM)
      effectiveSolvedState = mapSolvedState(effectiveSolvedState, MIRROR_ACROSS_M_MAPPING);
    if (state.mirrorAcrossS)
      effectiveSolvedState = mapSolvedState(effectiveSolvedState, MIRROR_ACROSS_S_MAPPING);
    if (state.randomYs > 0) {
      for (let i = 0; i < state.randomYs; ++i)
        effectiveSolvedState = mapSolvedState(effectiveSolvedState, Y_ROTATION_MAPPING);
    }

    // Don't attempt to apply a stickering mask if our kpuzzle isn't ready yet.
    let stickeringMask = null;
    if (state.kpuzzle) {
      const setupPattern = state.kpuzzle.defaultPattern().applyAlg(finalSetupAlg);
      stickeringMask = generateStickeringMask(setupPattern, effectiveSolvedState);
    }

    return recomputeSolvedState({ ...state, setupAlg: finalSetupAlg, effectiveSolvedState, stickeringMask });
  };

  const setCurrentAlg = (state: State, currentAlg: Algorithm): State => {
    const newState = {...state, currentAlg };

    // Is this pure??
    newState.moves = [];
    newState.startTime = Date.now();

    if (settings.randomAUF)
      newState.randomUs = Math.floor(Math.random() * 4);
    else
      newState.randomUs = 0;

    if (settings.randomYs)
      newState.randomYs = Math.floor(Math.random() * 4);
    else
      newState.randomYs = 0;

    if (settings.randomRotations1)
      newState.randomRotations = Math.floor(Math.random() * 4);
    else
      newState.randomRotations = 0;

    if (!settings.mirrorAcrossM)
      newState.mirrorAcrossM = false;
    else if (settings.randomizeMirrorAcrossM)
      newState.mirrorAcrossM = Math.random() < 0.5;
    else
      newState.mirrorAcrossM = true;

    if (!settings.mirrorAcrossS)
      newState.mirrorAcrossS = false;
    else if (settings.randomizeMirrorAcrossS)
      newState.mirrorAcrossS = Math.random() < 0.5;
    else
      newState.mirrorAcrossS = true;

    return recomputeSetup(newState);
  };

  const recomputeSolvedState = (state: State): State => {
    if (!state.kpuzzle) return state;

    const moveString = state.moves.map((move) => (move.move)).join(' '); // Is there a better way?
    const currentPattern = state.kpuzzle.defaultPattern().applyAlg(state.setupAlg).applyAlg(moveString);
    const solvedStateMap = {};
    Object.keys(SolvedState)
      .filter((key) => !isNaN(Number(SolvedState[key as keyof typeof SolvedState])))
      .forEach((key) => {
        solvedStateMap[key] = isPatternSolved(currentPattern, SolvedState[key as keyof typeof SolvedState]);
      });
    return { ...state, solvedStateMap };
  }

  const reducer = (state: State, action: Action): State => {
    switch (action.type) {
      case 'SET_KPUZZLE':
        return recomputeSetup({ ...state, kpuzzle: action.payload });
      case 'SET_CURRENT_ALG':
        return setCurrentAlg(state, action.payload);
      case 'ADD_MOVE':
      {
        const moves = [...state.moves, action.payload];
        const moveString = moves.map((move) => (move.move)).join(' '); // Is there a better way?
        const currentPattern = state.kpuzzle.defaultPattern().applyAlg(state.setupAlg).applyAlg(moveString);
        const isSolved = isPatternSolved(currentPattern, state.effectiveSolvedState);

        if (isSolved) {
          const solveStat: SolveStat = {
            name: state.currentAlg.name,
            timeOfSolve: new Date().toISOString(),
            moves,
            executionTime: moves[moves.length-1].timeOfMove - moves[0].timeOfMove,
            recognitionTime: moves[0].timeOfMove - state.startTime,
            AUFs: state.randomUs,
            Ys: state.randomYs,
            mirroredOverM: state.mirrorAcrossM,
            mirroredOverS: state.mirrorAcrossS,
          };

          const newState = { ...state, sessionStats: state.sessionStats.concat(solveStat) };

          // We need to reset everything and move to the next alg
          if (settings.playlistMode === 'ordered') {
            const currentIndex = currentAlgSet.algs.findIndex(alg => alg.name === state.currentAlg.name);
            const nextIndex = (currentIndex + 1) % currentAlgSet.algs.length;
            return setCurrentAlg(newState, currentAlgSet.algs[nextIndex]);
          } else {
            const randomIndex = Math.floor(Math.random() * currentAlgSet.algs.length);
            return setCurrentAlg(newState, currentAlgSet.algs[randomIndex]);
          }
        } else {
          return recomputeSolvedState({ ...state, moves });
        }
      }
      case 'RECOMPUTE_RANDOM_AUF':
      {
        let randomUs = 0;
        if (settings.randomAUF)
          randomUs = Math.floor(Math.random() * 4);
        return recomputeSetup({ ...state, randomUs});
      }
      case 'RECOMPUTE_RANDOM_YS':
      {
        let randomYs = 0;
        if (settings.randomYs)
          randomYs = Math.floor(Math.random() * 4);
        return recomputeSetup({ ...state, randomYs});
      }
      case 'RECOMPUTE_PREORIENTATION':
      {
        let randomRotations = 0;
        if (settings.randomRotations1)
          randomRotations = Math.floor(Math.random() * 4);
        return recomputeSetup({ ...state, randomRotations});
      }
      case 'RECOMPUTE_MIRROR_ACROSS_M':
      {
        let mirrorAcrossM;
        if (!settings.mirrorAcrossM)
          mirrorAcrossM = false;
        else if (settings.randomizeMirrorAcrossM)
          mirrorAcrossM = Math.random() < 0.5;
        else
          mirrorAcrossM = true;
        return recomputeSetup({ ...state, mirrorAcrossM});
      }
      case 'RECOMPUTE_MIRROR_ACROSS_S':
      {
        let mirrorAcrossS;
        if (!settings.mirrorAcrossS)
          mirrorAcrossS = false;
        else if (settings.randomizeMirrorAcrossS)
          mirrorAcrossS = Math.random() < 0.5;
        else
          mirrorAcrossS = true;
        return recomputeSetup({ ...state, mirrorAcrossS});
      }
    }
  };

  /////////////////////////////////////////////////////////////////////////////
  // finally, our state variables
  /////////////////////////////////////////////////////////////////////////////
  const [state, dispatch] = useReducer(reducer, initialState, () => initializeState(initialAlg, currentAlgSet, settings));
  const [stats, setStats] = useLocalStorage<SolveStat[]>({ key: 'stats' , defaultValue: {} });
  const playerRef = useRef<TwistyPlayer>(null);

  /////////////////////////////////////////////////////////////////////////////
  // useEffects
  /////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    const fetchPuzzle = async () => {
      try {
        const loadedKPuzzle: KPuzzle = await cube3x3x3.kpuzzle();
        dispatch({ type: 'SET_KPUZZLE', payload: loadedKPuzzle });
      } catch (error) {
        console.error("Error loading puzzle:", error);
      }
    };

    fetchPuzzle();
  }, []);

  useEffect(() => {
    if (conn) {
      const handleCubeEvent = async (event: GanCubeEvent) => {
        if (event.type === "MOVE") {
          playerRef.current.experimentalAddMove(event.move);
          dispatch({ type: 'ADD_MOVE', payload: { move: event.move, timeOfMove: Date.now() }});
        }
      };

      const sub = conn.events$.subscribe(handleCubeEvent);

      return () => {
        sub.unsubscribe();
      };
    }
  }, [conn]);

  useEffect(() => {
    if (initialAlg === null) return;
    dispatch({ type: 'SET_CURRENT_ALG', payload: initialAlg });
  }, [initialAlg]);

  // This isn't pure - will it ever get called twice in a row?
  // Do i need to make sure I don't dupicate update?  No, just like this:
  //            setSavedTimes((prev) => [...prev, data]);
  //          saveTime([...savedTimes, data]);
  // I also need to make sessionStats just whatever it is in localStorage
  useEffect(() => {
    if (state.sessionStats.length === 0) return;
    const recentSolve = state.sessionStats[state.sessionStats.length - 1];
    const newStats = stats;
    if (!(currentAlgSet.name in newStats))
      newStats[currentAlgSet.name] = [recentSolve];
    else
      newStats[currentAlgSet.name].push(recentSolve);
    setStats(newStats);
  }, [state.sessionStats]);

  useEffect(() => {
    dispatch({ type: 'RECOMPUTE_RANDOM_AUF' });
  }, [settings.randomAUF]);

  useEffect(() => {
    dispatch({ type: 'RECOMPUTE_RANDOM_YS' });
  }, [settings.randomYs]);

  useEffect(() => {
    dispatch({ type: 'RECOMPUTE_PREORIENTATION' });
  }, [settings.fullColourNeutrality, settings.firstRotation, settings.randomRotations1]);

  useEffect(() => {
    dispatch({ type: 'RECOMPUTE_MIRROR_ACROSS_M' });
  }, [settings.mirrorAcrossM, settings.randomizeMirrorAcrossM]);

  useEffect(() => {
    dispatch({ type: 'RECOMPUTE_MIRROR_ACROSS_S' });
  }, [settings.mirrorAcrossS, settings.randomizeMirrorAcrossS]);

  useEffect(() => {
    if (!playerRef.current) return;
    if (!settings.useMaskings) {
      playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(null);
    } else {
      playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(state.stickeringMask);
    }
   }, [settings.useMaskings, state.stickeringMask]);

  useEffect(() => {
    if (!playerRef.current) return;

    playerRef.current.alg = '';
    if (!settings.useMaskings) {
      playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(null);
    } else {
      playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(state.stickeringMask);
    }
   }, [state.stickeringMask, playerRef, settings.useMaskings]);

  /////////////////////////////////////////////////////////////////////////////
  // Rendering
  /////////////////////////////////////////////////////////////////////////////
  return (
    <Grid>
      <Grid.Col span={12}>
        <Card withBorder={true} padding="xs">
          <Card.Section withBorder={true}>
            <Center><Title mt="xs" mb="xs">Algorithm Set: {currentAlgSet.name}</Title></Center>
          </Card.Section>
          <Group gap="xs" mt="xs" justify="center">
            {Object.keys(SolvedState)
              .filter((key) => !isNaN(Number(SolvedState[key as keyof typeof SolvedState])))
              .map((key) => {
                const solvedStateValue = SolvedState[key as keyof typeof SolvedState];
                const isActive = (solvedStateValue & state.effectiveSolvedState) === solvedStateValue;
                return (
                  <Badge
                    key={key}
                    color={state.solvedStateMap[key] ? 'green' : 'gray'}
                    bd={isActive ? '1px solid var(--mantine-primary-color-5)': 'none'}
                  >
                    {key}
                  </Badge>
                );
              })}
          </Group>
        </Card>
      </Grid.Col>
      <Grid.Col span={4}>
      {state.currentAlg ? (
        <Card withBorder={true}>
          <Card.Section withBorder={true}>
            <Center>
              <Title order={2} >
                Case Name: <Text display="inline" className={styles.spoilerblur}>{state.currentAlg.name}</Text>
              </Title>
            </Center>
          </Card.Section>
          <Card.Section withBorder={true}>
            <Center><Text>{state.currentAlg.alg.join(' ')}</Text></Center>
          </Card.Section>
            <Stack align="center" gap={0}>
              <TimerView key={state.startTime} startTime={state.startTime}/>
              <twisty-player
                ref={playerRef}
                visualization="PG3D"
                control-panel="none"
                background="none"
                puzzle="3x3x3"
                tempo-scale="4"
                hint-facelets={settings.showHintFacelets ? "true" : "none"}
                experimental-setup-alg={state.setupAlg}
                style={{ width: "300px", height: "300px" }}
              />
            </Stack>
        </Card>
      ) : (
        <Skeleton />
      )}
      </Grid.Col>
      <Grid.Col span={8}>
        <Grid>
        <Grid.Col span={6}><SummaryStatsView algSetName={currentAlgSet.name}/></Grid.Col>
        <Grid.Col span={6}><Skeleton visible={true} height={200}/></Grid.Col>
        <Grid.Col span={6}><TimesListView algSetName={currentAlgSet.name}/></Grid.Col>
        <Grid.Col span={6}><Skeleton visible={true} height={200}/></Grid.Col>
        </Grid>
      </Grid.Col>
    </Grid>
  );
};

export default TrainerView;
