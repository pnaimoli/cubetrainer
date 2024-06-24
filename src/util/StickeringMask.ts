import { KPattern } from 'cubing/kpuzzle';
import { SolvedState } from './interfaces';
import {
  type PieceSet,
  PieceStickering,
  type StickeringMask,
  PuzzleStickering,
  StickeringManager,
} from "./mask";

// @ts-ignore
const getRotationsFromInitialState = (kpattern: KPattern): [number, number, number] => {
  // Centers in WCA state: [U, L, F, R, B, D]
  const WCA_CENTERS = kpattern.kpuzzle.defaultPattern().patternData.CENTERS.pieces;

  // Try up to 4 z' rotations to get 0 to the U face.
  let z = 0;
  let rotatedPattern = kpattern;
  if (rotatedPattern.patternData.CENTERS.pieces[0] !== WCA_CENTERS[0]) {
    for (z = 1; z < 5; z++) {
      rotatedPattern = rotatedPattern.applyAlg("z'");
      if (rotatedPattern.patternData.CENTERS.pieces[0] === WCA_CENTERS[0]) break;
    }
  }

  if (z < 4) {
    // We were able to get the U face on top using z rotations.
    // Now figure out how many y's we need to get the L face on the left.

    // Try up to 4 y' rotations to get 1 to the L face.
    let y = 0;
    if (rotatedPattern.patternData.CENTERS.pieces[1] !== WCA_CENTERS[1]) {
      for (y = 1; y < 4; y++) {
        rotatedPattern = rotatedPattern.applyAlg("y'");
        if (rotatedPattern.patternData.CENTERS.pieces[1] === WCA_CENTERS[1]) break;
      }
    }

    return [0, y, z];
  }

  // If we were unable to get the U face on top using z rotations, try x rotations.

  // Try up to 4 x' rotations to get 1 to the L face.
  let x = 0;
  if (rotatedPattern.patternData.CENTERS.pieces[0] !== WCA_CENTERS[0]) {
    for (x = 1; x < 4; x++) {
      rotatedPattern = rotatedPattern.applyAlg("x'");
      if (rotatedPattern.patternData.CENTERS.pieces[0] === WCA_CENTERS[0]) break;
    }
  }

  // Try up to 4 y' rotations to get 0 to the U face.
  let y = 0;
  if (rotatedPattern.patternData.CENTERS.pieces[1] !== WCA_CENTERS[1]) {
    for (y = 1; y < 4; y++) {
      rotatedPattern = rotatedPattern.applyAlg("y'");
      if (rotatedPattern.patternData.CENTERS.pieces[1] === WCA_CENTERS[1]) break;
    }
  }

  return [x, y, 0];
};

// @ts-ignore
export const generateStickeringMask = (kpattern: KPattern, solvedState: number): StickeringMask => {
  const kpuzzle = kpattern.kpuzzle;
  const puzzleStickering = new PuzzleStickering(kpuzzle);
  const m = new StickeringManager(kpuzzle);
  puzzleStickering.set(m.all(), PieceStickering.Ignored);

  if (solvedState & SolvedState.FULL) {
    puzzleStickering.set(m.all(), PieceStickering.Regular);
    return puzzleStickering.toStickeringMask();
  }

  const CENTERS = (): PieceSet => m.orbitPrefix("CENTER");
  const EDGES = (): PieceSet => m.orbitPrefix("EDGE");
  const CORNERS = (): PieceSet =>
    m.or([
      m.orbitPrefix("CORNER"),
      m.orbitPrefix("C4RNER"),
      m.orbitPrefix("C5RNER"),
    ]);

  // Always sticker centers for now
  puzzleStickering.set(CENTERS(), PieceStickering.Regular);

  const CROSS = (): PieceSet => m.and([m.move("D"), EDGES()]);
  const LL = (): PieceSet => m.move("U");
  // const F2L = (): PieceSet => m.and([m.not(LL()), CROSS()]);

  const edgeFR = (): PieceSet => m.and([m.and(m.moves(["F", "R"])), EDGES()]);
  const cornerDFR = (): PieceSet =>
    m.and([m.and(m.moves(["F", "R"])), CORNERS(), m.not(LL())]);
  const F2LFR = (): PieceSet => m.or([edgeFR(), cornerDFR()]);

  const edgeFL = (): PieceSet => m.and([m.and(m.moves(["F", "L"])), EDGES()]);
  const cornerDFL = (): PieceSet =>
    m.and([m.and(m.moves(["F", "L"])), CORNERS(), m.not(LL())]);
  const F2LFL = (): PieceSet => m.or([edgeFL(), cornerDFL()]);

  const edgeBR = (): PieceSet => m.and([m.and(m.moves(["B", "R"])), EDGES()]);
  const cornerDBR = (): PieceSet =>
    m.and([m.and(m.moves(["B", "R"])), CORNERS(), m.not(LL())]);
  const F2LBR = (): PieceSet => m.or([edgeBR(), cornerDBR()]);

  const edgeBL = (): PieceSet => m.and([m.and(m.moves(["B", "L"])), EDGES()]);
  const cornerDLB = (): PieceSet =>
    m.and([m.and(m.moves(["B", "L"])), CORNERS(), m.not(LL())]);
  const F2LBL = (): PieceSet => m.or([edgeBL(), cornerDLB()]);

  if (solvedState & SolvedState.CROSS) {
    puzzleStickering.set(CROSS(), PieceStickering.Regular);
  }
  if (solvedState & SolvedState.F2LFR) {
    puzzleStickering.set(F2LFR(), PieceStickering.Regular);
  }
  if (solvedState & SolvedState.F2LFL) {
    puzzleStickering.set(F2LFL(), PieceStickering.Regular);
  }
  if (solvedState & SolvedState.F2LBR) {
    puzzleStickering.set(F2LBR(), PieceStickering.Regular);
  }
  if (solvedState & SolvedState.F2LBL) {
    puzzleStickering.set(F2LBL(), PieceStickering.Regular);
  }
  if (solvedState & SolvedState.UEDGES) {
    puzzleStickering.set(m.and([LL(), EDGES()]), PieceStickering.Regular);
  }
  if (solvedState & SolvedState.UCORNERS) {
    puzzleStickering.set(m.and([LL(), CORNERS()]), PieceStickering.Regular);
  }
  if (solvedState & SolvedState.UEDGEFACES) {
    puzzleStickering.set(m.and([LL(), EDGES()]), PieceStickering.IgnoreNonPrimary);
  }
  if (solvedState & SolvedState.UCORNERFACES) {
    puzzleStickering.set(m.and([LL(), CORNERS()]), PieceStickering.IgnoreNonPrimary);
  }

  // console.log(JSON.stringify(puzzleStickering.toStickeringMask()));

  return puzzleStickering.toStickeringMask();
  //return {"orbits":{"EDGES":{"pieces":[{"facelets":["regular","regular","regular","regular","regular"]},{"facelets":["regular","regular","regular","regular","regular"]},{"facelets":["regular","regular","regular","regular","regular"]},{"facelets":["regular","regular","regular","regular","regular"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]}]},"CORNERS":{"pieces":[{"facelets":["regular","regular","regular","regular","regular"]},{"facelets":["regular","regular","regular","regular","regular"]},{"facelets":["regular","regular","regular","regular","regular"]},{"facelets":["regular","regular","regular","regular","regular"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]}]},"CENTERS":{"pieces":[{"facelets":["regular","regular","regular","regular","regular"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]},{"facelets":["ignored","ignored","ignored","ignored","ignored"]}]}}};
};
