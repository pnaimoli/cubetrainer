export const CROSS_NAMES: Record<string, string> = {
  D: 'White', U: 'Yellow', F: 'Green', B: 'Blue', R: 'Red', L: 'Orange'
};

// Rotation to put a given face on the D face
export const FACE_TO_D_ROTATION: Record<string, string> = {
  D: '',
  U: 'x2',
  F: "x'",
  B: 'x',
  R: 'z',
  L: "z'",
};

// Cross color for each face - matches what cross pieces look like on the 3D cube
export const FACE_COLORS: Record<string, string> = {
  D: '#FFFFFF',   // White
  U: '#FFFF00',   // Yellow
  F: '#00FF00',   // Green
  B: '#2266FF',   // Blue
  R: '#FF0000',   // Red
  L: '#FF9900',   // Orange
};

// Per-rotation face mapping: where does content on each face end up?
const SINGLE_ROTATION_MAP: Record<string, Record<string, string>> = {
  'x':  { U: 'B', B: 'D', D: 'F', F: 'U' },
  "x'": { U: 'F', F: 'D', D: 'B', B: 'U' },
  'x2': { U: 'D', D: 'U', F: 'B', B: 'F' },
  'y':  { F: 'R', R: 'B', B: 'L', L: 'F' },
  "y'": { F: 'L', L: 'B', B: 'R', R: 'F' },
  'y2': { F: 'B', B: 'F', R: 'L', L: 'R' },
  'z':  { U: 'R', R: 'D', D: 'L', L: 'U' },
  "z'": { U: 'L', L: 'D', D: 'R', R: 'U' },
  'z2': { U: 'D', D: 'U', R: 'L', L: 'R' },
};

function composeFaceMaps(...maps: Record<string, string>[]): Record<string, string> {
  const faces = ['U', 'D', 'F', 'B', 'R', 'L'];
  const result: Record<string, string> = {};
  for (const face of faces) {
    let current = face;
    for (const map of maps) {
      current = map[current] ?? current;
    }
    if (current !== face) result[face] = current;
  }
  return result;
}

/** Translate a physical move (e.g. "U'") into the equivalent display move
 *  when the 3D cube has been rotated by `rotation` (may be multiple tokens). */
export function translateMove(move: string, rotation: string): string {
  if (!rotation) return move;
  const parts = rotation.trim().split(/\s+/);
  const maps = parts.map(p => SINGLE_ROTATION_MAP[p] ?? {});
  const composed = composeFaceMaps(...maps);
  const face = move.charAt(0);
  const suffix = move.slice(1);
  return (composed[face] ?? face) + suffix;
}

/** Build a random rotation string (0-3 quarter turns) for the given axis. */
export function randomRotationString(axis: string): string {
  if (!axis) return '';
  const count = Math.floor(Math.random() * 4);
  if (count === 0) return '';
  if (count === 1) return axis;
  if (count === 2) return `${axis}2`;
  return `${axis}'`;
}
