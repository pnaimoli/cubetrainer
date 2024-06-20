// interfaces.ts

// Define an enumeration for the solved states
export enum SolvedState {
  Cross = 'cross',
  F2L = 'f2l',
  F2LFR = 'f2lfr',
  F2LFL = 'f2lfl',
  F2LBL = 'f2lbl',
  F2LBR = 'f2lbr',
  OLL = 'oll',
  PLL = 'pll',
  Full = 'full'
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

interface Settings {
  randomAUF: boolean;
  goInOrder: boolean;
  mirrorAcrossM: boolean;
  mirrorAcrossS: boolean;
  randomizeMirrorAcrossM: boolean;
  randomizeMirrorAcrossS: boolean;
  crossColor: CrossColor;
  useMaskings: boolean;
}

export const SOLVED_STATES: SolvedState[] = Object.values(SolvedState).filter(value => typeof value === 'string') as SolvedState[];
