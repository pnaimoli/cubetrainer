import { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { SolvedState } from './interfaces';

// Much of the inspiration here came from
// cubing.js/src/sites/experiments.cubing.net/cubing.js/3x3x3-formats/convert.ts

const pieceNames: Record<string, string[]> = {
  "EDGES": "UF UR UB UL DF DR DB DL FR FL BR BL".split(" "),
  "CORNERS": "UFR URB UBL ULF DRF DFL DLB DBR".split(" "),
  "CENTERS": "ULFRBD".split(""),
};

interface PieceInfo {
  piece: number;
  orientation: number;
}

function rotateLeft(s: string, i: number): string {
  return s.slice(i) + s.slice(0, i);
}

let pieceMap: { [s: string]: PieceInfo } | null = null;

function memoizePieceMap(kpuzzle: KPuzzle) {
  if (pieceMap !== null) return;
  pieceMap = {};

  for (const orbitDefinition of kpuzzle.definition.orbits) {
    pieceNames[orbitDefinition.orbitName].forEach((piece, idx) => {
      const numOri = orbitDefinition.orbitName === "CENTERS" ? 1 : orbitDefinition.numOrientations;
      for (let i = 0; i < numOri; i++) {
        const name = rotateLeft(piece, i);
        pieceMap![name] = { piece: idx, orientation: i };
        if (numOri === 3) {
          const altName = name[0] + name[2] + name[1];
          pieceMap![altName] = { piece: idx, orientation: i };
        }
      }
    });
  }
}

function kpatternToReidString(pattern: KPattern): string {
  const pieces: string[] = [];

  for (const orbitDefinition of pattern.kpuzzle.definition.orbits) {
    for (
      let i = 0;
      i < pattern.patternData[orbitDefinition.orbitName].pieces.length;
      i++
    ) {
      pieces.push(
        rotateLeft(
          pieceNames[orbitDefinition.orbitName][
            pattern.patternData[orbitDefinition.orbitName].pieces[i]
          ],
          pattern.patternData[orbitDefinition.orbitName].orientation[i],
        ),
      );
    }
  }

  return pieces.join(" ");
}

function isPieceCorrect(reidPieces: string[], pieceName: string): boolean {
  const pieceType = pieceName.length === 2 ? 'EDGES' : pieceName.length === 3 ? 'CORNERS' : null;
  if (!pieceType) {
    throw new Error('Invalid piece name');
  }

  if (pieceType === 'EDGES') {
    const actualPiece = reidPieces[pieceNames['EDGES'].indexOf(pieceName)];
    const expectedPiece = pieceName.split('').map(face => reidPieces[20 + pieceNames['CENTERS'].indexOf(face)]).join('');
    return actualPiece === expectedPiece;
  } else if (pieceType === 'CORNERS') {
    const actualPiece = reidPieces[12 + pieceNames['CORNERS'].indexOf(pieceName)];
    const expectedPiece = pieceName.split('').map(face => reidPieces[20 + pieceNames['CENTERS'].indexOf(face)]).join('');
    return actualPiece === expectedPiece;
  }
  return false;
}

function isStickerCorrect(reidPieces: string[], stickerName: string): boolean {
  const pieceType = stickerName.length === 2 ? 'EDGES' : stickerName.length === 3 ? 'CORNERS' : null;
  if (!pieceType) {
    throw new Error('Invalid sticker name');
  }

  const mainFace = stickerName[0];
  const pieceIndex = pieceType === 'EDGES' ? pieceNames['EDGES'].indexOf(stickerName) : pieceNames['CORNERS'].indexOf(stickerName);
  const actualSticker = reidPieces[pieceIndex][0];
  const expectedSticker = reidPieces[20 + pieceNames['CENTERS'].indexOf(mainFace)];

  return actualSticker === expectedSticker;
}

export function isPatternSolved(pattern: KPattern, solvedStates: number): boolean {
  if (pattern.kpuzzle.definition.name !== '3x3x3') {
    throw new Error('Unsupported puzzle type. Only 3x3x3 is supported.');
  }

  memoizePieceMap(pattern.kpuzzle);

  const reidString = kpatternToReidString(pattern);
  const reidPieces = reidString.split(" ");

  // Check if the pattern matches the solved states
  if (solvedStates & SolvedState.CROSS) {
    const crossEdges = ["DF", "DR", "DB", "DL"];
    for (const edge of crossEdges) {
      if (!isPieceCorrect(reidPieces, edge)) {
        return false;
      }
    }
  }

  if (solvedStates & SolvedState.F2LFR) {
    if (!isPieceCorrect(reidPieces, "FR") || !isPieceCorrect(reidPieces, "DRF")) {
      return false;
    }
  }

  if (solvedStates & SolvedState.F2LFL) {
    if (!isPieceCorrect(reidPieces, "FL") || !isPieceCorrect(reidPieces, "DFL")) {
      return false;
    }
  }

  if (solvedStates & SolvedState.F2LBL) {
    if (!isPieceCorrect(reidPieces, "BL") || !isPieceCorrect(reidPieces, "DLB")) {
      return false;
    }
  }

  if (solvedStates & SolvedState.F2LBR) {
    if (!isPieceCorrect(reidPieces, "BR") || !isPieceCorrect(reidPieces, "DBR")) {
      return false;
    }
  }

  if (solvedStates & SolvedState.TOPEDGES) {
    const ollEdges = ["UF", "UR", "UB", "UL"];
    for (const edge of ollEdges) {
      if (!isStickerCorrect(reidPieces, edge)) {
        return false;
      }
    }
  }

  if (solvedStates & SolvedState.TOPCORNERS) {
    const ollCorners = ["UFR", "URB", "UBL", "ULF"];
    for (const corner of ollCorners) {
      if (!isStickerCorrect(reidPieces, corner)) {
        return false;
      }
    }
  }

  if (solvedStates & SolvedState.FULL) {
    const allEdges = pieceNames['EDGES'];
    const allCorners = pieceNames['CORNERS'];
    for (const edge of allEdges) {
      if (!isPieceCorrect(reidPieces, edge)) {
        return false;
      }
    }
    for (const corner of allCorners) {
      if (!isPieceCorrect(reidPieces, corner)) {
        return false;
      }
    }
  }

  return true;
}
