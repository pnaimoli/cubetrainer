import { KPattern } from 'cubing/kpuzzle';
import { SolvedState } from './interfaces';

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

function memoizePieceMap(kpuzzle: any) {
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

export function isPatternSolved(pattern: KPattern, solvedStates: number): boolean {
  if (pattern.kpuzzle.definition.name !== '3x3x3') {
    throw new Error('Unsupported puzzle type. Only 3x3x3 is supported.');
  }

  memoizePieceMap(pattern.kpuzzle);

  const reidString = kpatternToReidString(pattern);
  const reidPieces = reidString.split(" ");
  console.log("REID:", reidString);

  // Check if the pattern matches the solved states
  if (solvedStates & SolvedState.F2LFR) {
    const actualFRPiece = reidPieces[pieceNames["EDGES"].indexOf("FR")];
    const expectedFRPiece = reidPieces[20+pieceNames["CENTERS"].indexOf("F")] + reidPieces[20+pieceNames["CENTERS"].indexOf("R")];
    if (actualFRPiece != expectedFRPiece) {
      return false;
    }

    const actualDRFPiece = reidPieces[12+pieceNames["CORNERS"].indexOf("DRF")];
    const expectedDRFPiece = reidPieces[20+pieceNames["CENTERS"].indexOf("D")] + reidPieces[20+pieceNames["CENTERS"].indexOf("R")] + reidPieces[20+pieceNames["CENTERS"].indexOf("F")];
    if (actualDRFPiece != expectedDRFPiece) {
      return false;
    }
  }
  if (solvedStates & SolvedState.F2LFL) {
    const actualFLPiece = reidPieces[pieceNames["EDGES"].indexOf("FL")];
    const expectedFLPiece = reidPieces[20+pieceNames["CENTERS"].indexOf("F")] + reidPieces[20+pieceNames["CENTERS"].indexOf("L")];
    if (actualFLPiece != expectedFLPiece) {
      return false;
    }

    const actualDFLPiece = reidPieces[12+pieceNames["CORNERS"].indexOf("DFL")];
    const expectedDFLPiece = reidPieces[20+pieceNames["CENTERS"].indexOf("D")] + reidPieces[20+pieceNames["CENTERS"].indexOf("F")] + reidPieces[20+pieceNames["CENTERS"].indexOf("L")];
    if (actualDFLPiece != expectedDFLPiece) {
      return false;
    }
  }
  return true;
}
