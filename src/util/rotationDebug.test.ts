import { expect } from 'chai';
import { KPuzzle } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

let kpuzzle: KPuzzle;

before(async () => {
  kpuzzle = await cube3x3x3.kpuzzle() as unknown as KPuzzle;
});

describe('Verify SINGLE_ROTATION_MAP against cubing.js', () => {
  // These must match SINGLE_ROTATION_MAP in crossRotation.ts
  const SINGLE_ROTATION_MAP: Record<string, Record<string, string>> = {
    'x':  { U: 'B', B: 'D', D: 'F', F: 'U' },
    "x'": { U: 'F', F: 'D', D: 'B', B: 'U' },
    'x2': { U: 'D', D: 'U', F: 'B', B: 'F' },
    'y':  { F: 'L', R: 'F', B: 'R', L: 'B' },
    "y'": { F: 'R', R: 'B', B: 'L', L: 'F' },
    'y2': { F: 'B', B: 'F', R: 'L', L: 'R' },
    'z':  { U: 'R', R: 'D', D: 'L', L: 'U' },
    "z'": { U: 'L', L: 'D', D: 'R', R: 'U' },
  };

  const centerNames = ['U', 'L', 'F', 'R', 'B', 'D'];

  for (const [rot, expectedMap] of Object.entries(SINGLE_ROTATION_MAP)) {
    it(`${rot} rotation matches cubing.js`, () => {
      const rotated = kpuzzle.defaultPattern().applyAlg(rot);
      const centers = rotated.patternData['CENTERS'];

      const actualMap: Record<string, string> = {};
      for (let i = 0; i < 6; i++) {
        const src = centerNames[centers.pieces[i]];
        const dst = centerNames[i];
        if (src !== dst) actualMap[src] = dst;
      }

      expect(actualMap).to.deep.equal(expectedMap);
    });
  }
});
