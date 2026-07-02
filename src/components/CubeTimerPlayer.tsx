import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { Stack } from '@mantine/core';
import 'cubing/twisty';
import { TwistyPlayer } from 'cubing/twisty';
import { KPuzzle } from 'cubing/kpuzzle';

import { StickeringMask, PuzzleStickering, PieceStickering, StickeringManager } from '../util/mask';
import SolveTimer, { SolveTimerHandle } from './SolveTimer';

export interface CubeTimerPlayerHandle {
  addMove: (move: string) => void;
  firstMove: (time?: number) => void;
  stop: () => void;
  stopAt: (time: number) => void;
  start: () => void;
  getStartTime: () => number;
  getTimes: () => { inspectionMs: number; executionMs: number };
}

interface CubeTimerPlayerProps {
  setupAlg: string;
  showHintFacelets: boolean;
  stickeringMask: StickeringMask | null;
  kpuzzle: KPuzzle | null;
  maskAfterFirstMove: boolean;
  caseKey: number;
  manualStart?: boolean;
  timerAdornment?: React.ReactNode;
  children?: React.ReactNode;
}

const CubeTimerPlayer = React.forwardRef<CubeTimerPlayerHandle, CubeTimerPlayerProps>(
  ({ setupAlg, showHintFacelets, stickeringMask, kpuzzle, maskAfterFirstMove, caseKey, manualStart = false, timerAdornment, children }, ref) => {
    const playerRef = useRef<TwistyPlayer>(null);
    const timerRef = useRef<SolveTimerHandle>(null);
    const startTimeRef = useRef(0);
    // Bumped after resetting the player alg. useLayoutEffect watches this
    // to start the timer in the same commit cycle, before the browser paints.
    const [resetCount, setResetCount] = useState(0);

    React.useImperativeHandle(ref, () => ({
      addMove: (move: string) => {
        playerRef.current?.experimentalAddMove(move);
      },
      firstMove: (time?: number) => {
        timerRef.current?.firstMove(time);
        if (maskAfterFirstMove && kpuzzle && playerRef.current) {
          const blindMask = new PuzzleStickering(kpuzzle);
          const mgr = new StickeringManager(kpuzzle);
          blindMask.set(mgr.all(), PieceStickering.Ignored);
          playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(blindMask.toStickeringMask());
        }
      },
      stop: () => {
        timerRef.current?.stop();
      },
      stopAt: (time: number) => {
        timerRef.current?.stopAt(time);
      },
      start: () => {
        const now = Date.now();
        startTimeRef.current = now;
        timerRef.current?.start(now);
      },
      getStartTime: () => startTimeRef.current,
      getTimes: () => timerRef.current?.getTimes() ?? { inspectionMs: 0, executionMs: 0 },
    }));

    // Reset the player alg and bump resetCount on every case change.
    // This is a regular useEffect so it runs after the DOM commit.
    useEffect(() => {
      const player = playerRef.current;
      if (!player) return;
      player.alg = '';
      player.experimentalModel.twistySceneModel.stickeringMaskRequest.set(stickeringMask);
      setResetCount(c => c + 1);
    }, [caseKey, setupAlg]); // eslint-disable-line react-hooks/exhaustive-deps

    // Start the timer synchronously during the commit phase (before paint).
    // The browser's next paint shows the timer at 0.000 and the cube
    // with the new setupAlg. Both appear on the same frame.
    useLayoutEffect(() => {
      if (resetCount > 0 && !manualStart) {
        const now = Date.now();
        startTimeRef.current = now;
        timerRef.current?.start(now);
      }
    }, [resetCount, manualStart]);

    // Apply stickering mask when it changes
    useEffect(() => {
      if (!playerRef.current) return;
      playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(stickeringMask);
    }, [stickeringMask]);

    // When maskAfterFirstMove is unchecked mid-solve, restore normal stickering
    useEffect(() => {
      if (!maskAfterFirstMove && playerRef.current) {
        playerRef.current.experimentalModel.twistySceneModel.stickeringMaskRequest.set(stickeringMask);
      }
    }, [maskAfterFirstMove]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <>
        <Stack align="center" gap={0} mt="xs">
          <div style={{ position: 'relative' }}>
            <SolveTimer ref={timerRef} autoStart={false} />
            {timerAdornment}
          </div>
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
        </Stack>
        {children}
      </>
    );
  }
);

export default CubeTimerPlayer;
