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
  'y':  { F: 'L', R: 'F', B: 'R', L: 'B' },
  "y'": { F: 'R', R: 'B', B: 'L', L: 'F' },
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

// Each solver slot is between two original-cube faces (the belt faces around the cross face).
// For opposite cross faces the belt is the same, so the face pairs are identical.
const SOLVER_SLOT_FACES: Record<string, Record<string, [string, string]>> = {
  D: { FR: ['F','R'], FL: ['F','L'], BL: ['B','L'], BR: ['B','R'] },
  U: { FR: ['F','R'], FL: ['F','L'], BL: ['B','L'], BR: ['B','R'] },
  F: { FR: ['U','R'], FL: ['U','L'], BL: ['D','L'], BR: ['D','R'] },
  B: { FR: ['U','R'], FL: ['U','L'], BL: ['D','L'], BR: ['D','R'] },
  R: { FR: ['U','F'], FL: ['U','B'], BL: ['D','B'], BR: ['D','F'] },
  L: { FR: ['U','F'], FL: ['U','B'], BL: ['D','B'], BR: ['D','F'] },
};

// Map a pair of belt faces (after rotation) to a visual slot name
const FACE_PAIR_TO_SLOT: Record<string, string> = {
  FR: 'FR', RF: 'FR', FL: 'FL', LF: 'FL',
  BL: 'BL', LB: 'BL', BR: 'BR', RB: 'BR',
};

/** Translate a solver slot name to its visual slot name after display rotation.
 *  crossFace is the original cross face, displayRotation is the full rotation string. */
export function translateSlot(solverSlot: string, crossFace: string, displayRotation: string): string {
  const pair = SOLVER_SLOT_FACES[crossFace]?.[solverSlot];
  if (!pair) return solverSlot;
  if (!displayRotation) return solverSlot;
  const parts = displayRotation.trim().split(/\s+/);
  const maps = parts.map(p => SINGLE_ROTATION_MAP[p] ?? {});
  const composed = composeFaceMaps(...maps);
  const f1 = composed[pair[0]] ?? pair[0];
  const f2 = composed[pair[1]] ?? pair[1];
  return FACE_PAIR_TO_SLOT[f1 + f2] ?? solverSlot;
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
