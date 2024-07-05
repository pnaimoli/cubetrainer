// interfaces.ts

// Define an enumeration for the solved states
export enum SolvedState {
  FULL       = 1 << 0,
  CROSS      = 1 << 1,
  F2LFR      = 1 << 2,
  F2LFL      = 1 << 3,
  F2LBL      = 1 << 4,
  F2LBR      = 1 << 5,
  //UCORNERS   = 1 << 6,
  //UEDGES     = 1 << 7,
  UEDGEFACES   = 1 << 8,
  UCORNERFACES = 1 << 9,

  F2L = CROSS | F2LFR | F2LFL | F2LBL | F2LBR,
  EOLL  = F2L | UEDGEFACES,
  OLL = F2L | UEDGEFACES | UCORNERFACES,
  //COLL = F2L | UCORNERS | UEDGEFACES,
}

// Define an enumeration for the valid moves
export enum ValidMove {
  R = 'R', RPrime = "R'", R2 = 'R2', R2Prime = "R2'", R3 = 'R3',
  L = 'L', LPrime = "L'", L2 = 'L2', L2Prime = "L2'", L3 = 'L3',
  U = 'U', UPrime = "U'", U2 = 'U2', U2Prime = "U2'", U3 = 'U3',
  D = 'D', DPrime = "D'", D2 = 'D2', D2Prime = "D2'", D3 = 'D3',
  F = 'F', FPrime = "F'", F2 = 'F2', F2Prime = "F2'", F3 = 'F3',
  B = 'B', BPrime = "B'", B2 = 'B2', B2Prime = "B2'", B3 = 'B3',
  M = 'M', MPrime = "M'", M2 = 'M2', M2Prime = "M2'", M3 = 'M3',
  S = 'S', SPrime = "S'", S2 = 'S2', S2Prime = "S2'", S3 = 'S3',
  E = 'E', EPrime = "E'", E2 = 'E2', E2Prime = "E2'", E3 = 'E3',
  r = 'r', rPrime = "r'", r2 = 'r2', r2Prime = "r2'", r3 = 'r3',
  l = 'l', lPrime = "l'", l2 = 'l2', l2Prime = "l2'", l3 = 'l3',
  u = 'u', uPrime = "u'", u2 = 'u2', u2Prime = "u2'", u3 = 'u3',
  d = 'd', dPrime = "d'", d2 = 'd2', d2Prime = "d2'", d3 = 'd3',
  f = 'f', fPrime = "f'", f2 = 'f2', f2Prime = "f2'", f3 = 'f3',
  b = 'b', bPrime = "b'", b2 = 'b2', b2Prime = "b2'", b3 = 'b3',
  x = 'x', xPrime = "x'", x2 = 'x2', x2Prime = "x2'", x3 = 'x3',
  y = 'y', yPrime = "y'", y2 = 'y2', y2Prime = "y2'", y3 = 'y3',
  z = 'z', zPrime = "z'", z2 = 'z2', z2Prime = "z2'", z3 = 'z3',
}

// Use the enumeration in the Alg interface
export interface Alg {
  name: string;
  alg: ValidMove[];
  solved: SolvedState;
}

export interface AlgSet {
  name: string;
  algs: Alg[];
}

// Define an enumeration for cube rotations
export enum CubeRotation {
  x = 'x', x2 = 'x2', xPrime = "x'", y = 'y', y2 = 'y2', yPrime = "y'", z = 'z', z2 = 'z2', zPrime = "z'"
}

// https://danielbarta.com/literal-iteration-typescript/
const PlaylistModes = ['ordered', 'shuffle', 'random'];
type PlaylistMode = typeof PlaylistModes[number];

const LoopModes = ['no loop', 'loop', 'loop1'];
type LoopMode = typeof LoopModes[number];

export interface Settings {
  randomAUF: boolean;
  randomYs: boolean;
  playlistMode: PlaylistMode;
  loopMode: LoopMode;
  mirrorAcrossM: boolean;
  mirrorAcrossS: boolean;
  randomizeMirrorAcrossM: boolean;
  randomizeMirrorAcrossS: boolean;
  showHintFacelets: boolean;
  useMaskings: boolean;
  fullColourNeutrality: boolean;
  firstRotation: string;
  randomRotations1: string;
}

// Export arrays of enum values for easy usage
export const SOLVED_STATES: SolvedState[] = Object.values(SolvedState).filter(value => typeof value === 'string') as SolvedState[];
export const CUBE_ROTATIONS: CubeRotation[] = Object.values(CubeRotation).filter(value => typeof value === 'string') as CubeRotation[];

export function cycleSetting<T extends keyof Settings>(settings: Settings, key: T): Settings {
  const possibleValues = {
    playlistMode: PlaylistModes,
    loopMode: LoopModes,
  } as const;

  // Ensure TypeScript understands that `possibleValues` can be indexed by `key`
  const values = possibleValues[key as keyof typeof possibleValues] as unknown as string[];
  const currentIndex = values.indexOf(settings[key] as unknown as string);
  const nextIndex = (currentIndex + 1) % values.length;
  const newSettings = { ...settings, [key]: values[nextIndex] };
  return newSettings;
}

interface Move {
  move: string;
  timeOfMove: number;
  timeOfMoveFromCube?: number;
}

export interface SolveStat {
  name: string;
  timeOfSolve: string; // ISO string
  moves: Move[];
  executionTime: number; // in milliseconds
  recognitionTime: number; // in milliseconds
  AUFs: number; // Number of AUF moves
  Ys: number; // Number of Y rotations
  mirroredOverM: boolean;
  mirroredOverS: boolean;
}
