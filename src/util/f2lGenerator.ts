// y rotation face remapping tables (indexed by rotation count 0-3)
// rotation 1 (y): F→R, R→B, B→L, L→F
const Y_REMAP: Record<string, string>[] = [
  {}, // 0: identity
  { F:'R', R:'B', B:'L', L:'F', f:'r', r:'b', b:'l', l:'f' }, // y
  { F:'B', R:'L', B:'F', L:'R', f:'b', r:'l', b:'f', l:'r' }, // y2
  { F:'L', R:'F', B:'R', L:'B', f:'l', r:'f', b:'r', l:'b' }, // y'
];

/**
 * Remove y-axis rotations from an alg by remapping subsequent face moves.
 * Handles y, y', y2 rotations and d/d' wide moves (d = y' U, d' = U' y).
 * The resulting alg has the same piece effect with no rotations.
 */
export function derotateAlg(alg: string): string {
  const moves = alg.split(/\s+/);
  let rot = 0; // accumulated y rotation (0-3)
  const output: string[] = [];

  for (const move of moves) {
    const m = move.match(/^([A-Za-z])(\d*)('?)$/);
    if (!m) { output.push(move); continue; }
    const [, face, count, prime] = m;

    // Pure y rotations
    if (face === 'y') {
      const amount = count === '2' ? 2 : prime === "'" ? 3 : 1;
      rot = (rot + amount) % 4;
      continue;
    }

    // d wide move: d = y' then U (they commute since y doesn't affect U)
    if (face === 'd' && !count) {
      if (prime === "'") {
        output.push("U'");
        rot = (rot + 1) % 4;
      } else {
        rot = (rot + 3) % 4;
        output.push('U');
      }
      continue;
    }

    // Remap face through accumulated rotation
    const newFace = Y_REMAP[rot][face] ?? face;
    output.push(`${newFace}${count}${prime}`);
  }

  return output.join(' ');
}

function mirrorMoveOverM(move: string): string {
  const match = move.match(/^([A-Za-z])(\d*)('?)$/);
  if (!match) return move;
  const [, face, count, prime] = match;
  const faceSwap: Record<string, string> = { R: 'L', L: 'R', r: 'l', l: 'r' };
  const newFace = faceSwap[face] ?? face;
  const newPrime = prime === "'" ? '' : "'";
  return `${newFace}${count}${newPrime}`;
}

export function mirrorAlg(alg: string): string {
  return alg.split(/\s+/).map(mirrorMoveOverM).join(' ');
}

import type { AlgEntry } from './algDatabase';

interface F2LCase {
  name: string;
  alg: string;
}

let parsedF2L: F2LCase[] | null = null;

function parseF2L(f2lPreset: string): F2LCase[] {
  if (parsedF2L) return parsedF2L;
  parsedF2L = f2lPreset.trim().split('\n').map(line => {
    const parts = line.split(',').map(s => s.trim());
    return { name: parts[0], alg: parts[1] };
  });
  return parsedF2L;
}

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateFRFLSample(f2lPreset: string, count: number): string;
export function generateFRFLSample(entries: AlgEntry[], count: number): string;
export function generateFRFLSample(input: string | AlgEntry[], count: number): string {
  const cases: F2LCase[] = typeof input === 'string'
    ? parseF2L(input)
    : input.map(e => ({ name: e.name, alg: e.alg }));

  // Generate all combos as [frIndex, flIndex] pairs
  const allCombos: [number, number][] = [];
  for (let i = 0; i < cases.length; i++) {
    for (let j = 0; j < cases.length; j++) {
      allCombos.push([i, j]);
    }
  }

  const sampled = shuffle(allCombos).slice(0, count);

  return sampled.map(([fi, fj]) => {
    const fr = cases[fi];
    const fl = cases[fj];
    const derotatedFr = derotateAlg(fr.alg);
    const derotatedFl = derotateAlg(mirrorAlg(fl.alg));
    return `${fr.name}+${fl.name}, ${derotatedFr} ${derotatedFl}, F2L`;
  }).join('\n');
}
