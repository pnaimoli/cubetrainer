import { expect } from 'chai';
import { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';
import { SolvedState } from './interfaces';
import { generateStickerMask } from './StickerMask';

const R = { facelets: new Array(5).fill("regular") };
//const D = { facelets: new Array(5).fill("dim") };
const I = { facelets: new Array(5).fill("ignored") };
const R1 = { ...I, facelets: [...I.facelets] }; R1.facelets[0] = "regular";
const R2 = { ...I, facelets: [...I.facelets] }; R2.facelets[1] = "regular";
const R3 = { ...I, facelets: [...I.facelets] }; R3.facelets[2] = "regular";
const D1 = { ...R, facelets: [...R.facelets] }; D1.facelets[0] = "dim";
const D2 = { ...R, facelets: [...R.facelets] }; D2.facelets[1] = "dim";
const D3 = { ...R, facelets: [...R.facelets] }; D3.facelets[2] = "dim";
const I1 = { ...R, facelets: [...R.facelets] }; I1.facelets[0] = "ignored";
const I2 = { ...R, facelets: [...R.facelets] }; I2.facelets[1] = "ignored";
const I3 = { ...R, facelets: [...R.facelets] }; I3.facelets[2] = "ignored";

describe('StickerMask Test', () => {
  let kpuzzle: KPuzzle;

  before(async () => {
    kpuzzle = await cube3x3x3.kpuzzle() as unknown as KPuzzle;
  });

  it("WCA Starting position + sune", async () => {
    // This is a sune
    const pattern: KPattern = new KPattern(kpuzzle, {
      EDGES: {
        pieces: [0, 3, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11],
        orientation: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      },
      CORNERS: {
        pieces: [2, 3, 0, 1, 4, 5, 6, 7],
        orientation: [1, 0, 1, 1, 0, 0, 0, 0]
      },
      CENTERS: {
        pieces: [0, 1, 2, 3, 4, 5],
        orientation: [0, 0, 0, 0, 0, 0],
        orientationMod: [1, 1, 1, 1, 1, 1]
      }
    });

    expect(JSON.stringify(generateStickerMask(pattern, SolvedState.FULL))).to.equal(JSON.stringify({
      orbits: {
        EDGES: {
          pieces: [R, R, R, R, R, R, R, R, R, R, R, R],
        },
        CORNERS: {
          pieces: [R, R, R, R, R, R, R, R],
        },
        CENTERS: {
          pieces: [R, R, R, R, R, R],
        },
      }
    }), "FULL");

    expect(JSON.stringify(generateStickerMask(pattern, SolvedState.OLL))).to.equal(JSON.stringify({
      orbits: {
        EDGES: {
          pieces: [R1, R1, R1, R1, R, R, R, R, R, R, R, R],
        },
        CORNERS: {
          pieces: [R1, R1, R1, R1, R, R, R, R],
        },
        CENTERS: {
          pieces: [R, R, R, R, R, R],
        },
      }}), "OLL");

    expect(JSON.stringify(generateStickerMask(pattern, SolvedState.F2L))).to.equal(JSON.stringify({
      orbits: {
        EDGES: {
          pieces: [I, I, I, I, R, R, R, R, R, R, R, R],
        },
        CORNERS: {
          pieces: [I, I, I, I, R, R, R, R],
        },
        CENTERS: {
          pieces: [R, R, R, R, R, R],
        },
      }}), "F2L");

    expect(JSON.stringify(generateStickerMask(pattern, SolvedState.F2LFR))).to.equal(JSON.stringify({
      orbits: {
        EDGES: {
          pieces: [I, I, I, I, I, I, I, I, R, I, I, I],
        },
        CORNERS: {
          pieces: [I, I, I, I, R, I, I, I],
        },
        CENTERS: {
          pieces: [R, R, R, R, R, R],
        },
      }}), "F2LFR");

    expect(JSON.stringify(generateStickerMask(pattern, SolvedState.CROSS | SolvedState.F2LFR))).to.equal(JSON.stringify({
      orbits: {
        EDGES: {
          pieces: [I, I, I, I, R, R, R, R, R, I, I, I],
        },
        CORNERS: {
          pieces: [I, I, I, I, R, I, I, I],
        },
        CENTERS: {
          pieces: [R, R, R, R, R, R],
        },
      }}), "CROSS | F2LFR");

    expect(JSON.stringify(generateStickerMask(pattern, SolvedState.CROSS | SolvedState.F2LFR | SolvedState.F2LBL | SolvedState.F2LBR ))).to.equal(JSON.stringify({
      orbits: {
        EDGES: {
          pieces: [I, I, I, I, R, R, R, R, R, I, R, R],
        },
        CORNERS: {
          pieces: [I, I, I, I, R, I, R, R],
        },
        CENTERS: {
          pieces: [R, R, R, R, R, R],
        },
      }}), "CROSS | F2LFR | F2LBL | F2LBR");
  });
});
