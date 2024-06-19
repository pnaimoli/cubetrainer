// interfaces.ts
export interface Alg {
  name: string;
  alg: string;
  solved: 'cross' | 'f2l' | 'f2lfr' | 'f2lfl' | 'f2lbl' | 'f2lbr' | 'oll' | 'pll' | 'full';
}

export interface AlgSet {
  name: string;
  algs: Alg[];
}
