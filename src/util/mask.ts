// taken from cubing/puzzles/stickerings/mask.ts

import type { Move } from "cubing/alg";
import type { KPuzzle } from "cubing/kpuzzle";

export type FaceletMeshStickeringMask =
  | "regular"
  | "dim"
  | "oriented"
  | "experimentalOriented2" // TODO
  | "ignored"
  | "invisible";

export type FaceletStickeringMask = FaceletMeshStickeringMask;

export type PieceStickeringMask = {
  facelets: FaceletStickeringMask[];
};

export type OrbitStickeringMask = {
  pieces: PieceStickeringMask[];
};

export type StickeringMask = {
  orbits: Record<string, OrbitStickeringMask>;
};

// TODO: Revert this to a normal enum, or write a standard to codify the names?
export enum PieceStickering {
  Regular = "Regular",
  Dim = "Dim",
  Ignored = "Ignored",
  OrientationStickers = "OrientationStickers",
  Invisible = "Invisible",
  Ignoriented = "Ignoriented",
  IgnoreNonPrimary = "IgnoreNonPrimary",
  PermuteNonPrimary = "PermuteNonPrimary",
  OrientationWithoutPermutation = "OrientationWithoutPermutation",
  ExperimentalOrientationWithoutPermutation2 = "ExperimentalOrientationWithoutPermutation2", // TODO
}

export class PieceAnnotation<T> {
  kpuzzle: KPuzzle;
  stickerings: Map<string, T[]> = new Map();
  constructor(kpuzzle: KPuzzle, defaultValue: T) {
    this.kpuzzle = kpuzzle;
    for (const orbitDefinition of kpuzzle.definition.orbits) {
      this.stickerings.set(
        orbitDefinition.orbitName,
        new Array(orbitDefinition.numPieces).fill(defaultValue),
      );
    }
  }
}

const regular = "regular";
const ignored = "ignored";
const oriented = "oriented";
const experimentalOriented2 = "experimentalOriented2";
const invisible = "invisible";
const dim = "dim";

// We specify 5 facelets, because that's the maximum we need for any built-in puzzles (e.g. Megaminx centers or icosa vertices).
// TODO: use "primary" and "non-primary" fields instead of listing all non-primary facelets.
const pieceStickerings: Record<string, PieceStickeringMask> = {
  // regular
  [PieceStickering.Regular]: {
    // r
    facelets: [regular, regular, regular, regular, regular],
  },

  // ignored
  [PieceStickering.Ignored]: {
    // i
    facelets: [ignored, ignored, ignored, ignored, ignored],
  },

  // oriented stickers
  [PieceStickering.OrientationStickers]: {
    // o
    facelets: [oriented, oriented, oriented, oriented, oriented],
  },

  // "OLL"
  [PieceStickering.IgnoreNonPrimary]: {
    // riiii
    facelets: [regular, ignored, ignored, ignored, ignored],
  },

  // invisible
  [PieceStickering.Invisible]: {
    // invisiblePiece
    facelets: [invisible, invisible, invisible, invisible, invisible],
  },

  // "PLL"
  [PieceStickering.PermuteNonPrimary]: {
    // drrrr
    facelets: [dim, regular, regular, regular, regular],
  },

  // ignored
  [PieceStickering.Dim]: {
    // d
    facelets: [dim, dim, dim, dim, dim],
  },

  // "OLL"
  [PieceStickering.Ignoriented]: {
    // diiii
    facelets: [dim, ignored, ignored, ignored, ignored],
  },
  [PieceStickering.OrientationWithoutPermutation]: {
    // oiiii
    facelets: [oriented, ignored, ignored, ignored, ignored],
  },
  [PieceStickering.ExperimentalOrientationWithoutPermutation2]: {
    // oiiii
    facelets: [experimentalOriented2, ignored, ignored, ignored, ignored],
  },
};

export function getPieceStickeringMask(
  pieceStickering: PieceStickering,
): PieceStickeringMask {
  return pieceStickerings[pieceStickering];
}

export class PuzzleStickering extends PieceAnnotation<PieceStickering> {
  constructor(kpuzzle: KPuzzle) {
    super(kpuzzle, PieceStickering.Regular);
  }

  set(pieceSet: PieceSet, pieceStickering: PieceStickering): PuzzleStickering {
    for (const [orbitName, pieces] of this.stickerings.entries()) {
      for (let i = 0; i < pieces.length; i++) {
        if (pieceSet.stickerings.get(orbitName)![i]) {
          pieces[i] = pieceStickering;
        }
      }
    }
    return this;
  }

  rotate(moveSource: Move | string | (Move | string)[]): StickeringMask {
    const moves = Array.isArray(moveSource) ? moveSource : [moveSource];
    const stickeringMask: StickeringMask = this.toStickeringMask();

    for (const move of moves) {
      // console.log("Processing", move, "rotation");
      // console.log("Before", this.stickerings);
      const transformation = this.kpuzzle.moveToTransformation(move);

      for (const orbitDefinition of this.kpuzzle.definition.orbits) {
        const pieces = stickeringMask.orbits[orbitDefinition.orbitName].pieces;

        const newPieces: { facelets: FaceletMeshStickeringMask[], permIndex: number }[] = pieces.map((piece, i) => {
          if (!piece) {
            return { facelets: new Array(5).fill("ignored" as FaceletMeshStickeringMask), permIndex: i };
          }
          const permIndex = transformation.transformationData[orbitDefinition.orbitName].permutation[i];
          const oriDelta = transformation.transformationData[orbitDefinition.orbitName].orientationDelta[i];
          return {
            facelets: this.rotateFacelets(piece.facelets.slice(), oriDelta, orbitDefinition.numOrientations),
            permIndex,
          };
        });

        // console.log(orbitDefinition.orbitName, newPieces)
        for (let i = 0; i < newPieces.length; i++) {
          // Which piece is going in the new [i] location?  Whatever was in newPieces[i].permIndex before.
          pieces[i] = { facelets: newPieces[newPieces[i].permIndex].facelets.slice() };
        }
        // console.log(orbitDefinition.orbitName, pieces)
      }
    }

    return stickeringMask;
  }

  private rotateFacelets(facelets: FaceletStickeringMask[], orientationDelta: number, numOrientations: number): FaceletStickeringMask[] {
    if (orientationDelta === 0) {
      return facelets;
    }
    const newFacelets = facelets.slice();
    for (let i = 0; i < numOrientations; i++) {
      newFacelets[(i - orientationDelta + numOrientations) % numOrientations] = facelets[i];
    }
    return newFacelets;
  }

  toStickeringMask(): StickeringMask {
    const stickeringMask: StickeringMask = { orbits: {} };
    for (const [orbitName, pieceStickerings] of this.stickerings.entries()) {
      const pieces: PieceStickeringMask[] = [];
      const orbitStickeringMask: OrbitStickeringMask = {
        pieces,
      };
      stickeringMask.orbits[orbitName] = orbitStickeringMask;
      for (const pieceStickering of pieceStickerings) {
        pieces.push(getPieceStickeringMask(pieceStickering));
      }
    }
    return stickeringMask;
  }
}

export type PieceSet = PieceAnnotation<boolean>;

export class StickeringManager {
  constructor(private kpuzzle: KPuzzle) {}

  and(pieceSets: PieceSet[]): PieceSet {
    const newPieceSet = new PieceAnnotation<boolean>(this.kpuzzle, false);
    for (const orbitDefinition of this.kpuzzle.definition.orbits) {
      pieceLoop: for (let i = 0; i < orbitDefinition.numPieces; i++) {
        newPieceSet.stickerings.get(orbitDefinition.orbitName)![i] = true;
        for (const pieceSet of pieceSets) {
          if (!pieceSet.stickerings.get(orbitDefinition.orbitName)![i]) {
            newPieceSet.stickerings.get(orbitDefinition.orbitName)![i] = false;
            continue pieceLoop;
          }
        }
      }
    }
    return newPieceSet;
  }

  or(pieceSets: PieceSet[]): PieceSet {
    // TODO: unify impl with and?
    const newPieceSet = new PieceAnnotation<boolean>(this.kpuzzle, false);
    for (const orbitDefinition of this.kpuzzle.definition.orbits) {
      pieceLoop: for (let i = 0; i < orbitDefinition.numPieces; i++) {
        newPieceSet.stickerings.get(orbitDefinition.orbitName)![i] = false;
        for (const pieceSet of pieceSets) {
          if (pieceSet.stickerings.get(orbitDefinition.orbitName)![i]) {
            newPieceSet.stickerings.get(orbitDefinition.orbitName)![i] = true;
            continue pieceLoop;
          }
        }
      }
    }
    return newPieceSet;
  }

  not(pieceSet: PieceSet): PieceSet {
    const newPieceSet = new PieceAnnotation<boolean>(this.kpuzzle, false);
    for (const orbitDefinition of this.kpuzzle.definition.orbits) {
      for (let i = 0; i < orbitDefinition.numPieces; i++) {
        newPieceSet.stickerings.get(orbitDefinition.orbitName)![i] =
          !pieceSet.stickerings.get(orbitDefinition.orbitName)![i];
      }
    }
    return newPieceSet;
  }

  all(): PieceSet {
    return this.and(this.moves([])); // TODO: are the degenerate cases for and/or the wrong way around
  }

  move(moveSource: Move | string): PieceSet {
    const transformation = this.kpuzzle.moveToTransformation(moveSource);
    const newPieceSet = new PieceAnnotation<boolean>(this.kpuzzle, false);
    for (const orbitDefinition of this.kpuzzle.definition.orbits) {
      for (let i = 0; i < orbitDefinition.numPieces; i++) {
        if (
          transformation.transformationData[orbitDefinition.orbitName]
            .permutation[i] !== i ||
          transformation.transformationData[orbitDefinition.orbitName]
            .orientationDelta[i] !== 0
        ) {
          newPieceSet.stickerings.get(orbitDefinition.orbitName)![i] = true;
        }
      }
    }
    return newPieceSet;
  }

  moves(moveSources: (Move | string)[]): PieceSet[] {
    return moveSources.map((moveSource) => this.move(moveSource));
  }

  orbits(orbitNames: string[]): PieceSet {
    const pieceSet = new PieceAnnotation<boolean>(this.kpuzzle, false);
    for (const orbitName of orbitNames) {
      pieceSet.stickerings.get(orbitName)!.fill(true);
    }
    return pieceSet;
  }

  orbitPrefix(orbitPrefix: string): PieceSet {
    const pieceSet = new PieceAnnotation<boolean>(this.kpuzzle, false);
    for (const orbitDefinition of this.kpuzzle.definition.orbits) {
      if (orbitDefinition.orbitName.startsWith(orbitPrefix)) {
        pieceSet.stickerings.get(orbitDefinition.orbitName)!.fill(true);
      }
    }
    return pieceSet;
  }
}
