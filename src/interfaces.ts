// interfaces.ts
export interface Alg {
  name: string;
  alg: string;
}

export interface AlgSet {
  name: string;
  algs: Alg[];
}
