// interfaces.ts

// Define an enumeration for the solved states
export enum SolvedState {
  FULL       = 1 << 0,
  CROSS      = 1 << 1,
  F2LFR      = 1 << 2,
  F2LFL      = 1 << 3,
  F2LBL      = 1 << 4,
  F2LBR      = 1 << 5,
  TOPCORNERS = 1 << 6,
  TOPEDGES   = 1 << 7,

  F2L = F2LFR | F2LFL | F2LBL | F2LBR,
  EOLL  = F2L | TOPEDGES,
  OLL = F2L | TOPCORNERS | TOPEDGES,
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

// Extend the Settings interface to include cube rotation settings
export interface Settings {
  randomAUF: boolean;
  randomAdF: boolean;
  goInOrder: boolean;
  mirrorAcrossM: boolean;
  mirrorAcrossS: boolean;
  randomizeMirrorAcrossM: boolean;
  randomizeMirrorAcrossS: boolean;
  useMaskings: boolean;
  fullColourNeutrality: boolean;
  firstRotation: CubeRotation | '';
  randomRotations1: CubeRotation | '';
}

// Export arrays of enum values for easy usage
export const SOLVED_STATES: SolvedState[] = Object.values(SolvedState).filter(value => typeof value === 'string') as SolvedState[];
export const CUBE_ROTATIONS: CubeRotation[] = Object.values(CubeRotation).filter(value => typeof value === 'string') as CubeRotation[];
