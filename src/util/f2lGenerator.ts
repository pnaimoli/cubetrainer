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

const RANDOM_U_TURNS = ['', 'U', "U'", 'U2'];

export function generateOneFRFL(flEntries: AlgEntry[], frEntries: AlgEntry[]): { name: string; alg: string } {
  const fl = flEntries[Math.floor(Math.random() * flEntries.length)];
  const fr = frEntries[Math.floor(Math.random() * frEntries.length)];
  const derotatedFr = derotateAlg(fr.alg);
  const randomU = RANDOM_U_TURNS[Math.floor(Math.random() * RANDOM_U_TURNS.length)];
  const derotatedFl = derotateAlg(mirrorAlg(fl.alg));
  // Solution order: FR then FL. Inverse (setup) scrambles FL first, then FR.
  const algParts = [derotatedFr, randomU, derotatedFl].filter(Boolean);
  return { name: `FL:${fl.name} FR:${fr.name}`, alg: algParts.join(' ') };
}
