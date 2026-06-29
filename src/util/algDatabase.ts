import { SolvedState } from './interfaces';
import { derotateAlg } from './f2lGenerator';

export interface AlgEntry {
  name: string;
  alg: string;
  solvedState: SolvedState;
}

function parsePresetString(preset: string, solvedState: SolvedState, shouldDerotate: boolean): AlgEntry[] {
  return preset.trim().split('\n').map(line => {
    const parts = line.split(',').map(s => s.trim());
    const name = parts[0];
    // Strip parentheses from the alg (same as AddAlgSetView parsing)
    const rawAlg = parts[1].replace(/[()]/g, '');
    const alg = shouldDerotate ? derotateAlg(rawAlg) : rawAlg;
    return { name, alg, solvedState };
  });
}

// Raw preset strings (kept here to avoid circular dependency with algPresets)
const F2L_RAW = `
1, U R U' R', F2L
2, y U' L' U L, F2L
3, y L' U' L, F2L
4, R U R', F2L
5, U' R U R' U2 R U' R', F2L
6, d R' U' R U2 R' U R, F2L
7, U' R U2 R' U2 R U' R', F2L
8, d R' U2 R U2 R' U R, F2L
9, U' R U' R' U F' U' F, F2L
10, U' R U R' U R U R', F2L
11, U' R U2 R' U F' U' F, F2L
12, R U' R' U R U' R' U2 R U' R', F2L
13, y' U R' U R U' R' U' R, F2L
14, U' R U' R' U R U R', F2L
15, R U R' U2 R U' R' U R U' R', F2L
16, R U' R' U2 F' U' F, F2L
17, R U2 R' U' R U R', F2L
18, y' R' U2 R U R' U' R, F2L
19, U R U2 R' U R U' R', F2L
20, y' U' R' U2 R U' R' U R, F2L
21, R U' R' U2 R U R', F2L
22, F' L' U2 L F, F2L
23, R U R' U2 R U R' U' R U R', F2L
24, F U R U' R' F' R U' R', F2L
25, R' F' R U R U' R' F, F2L
26, U R U' R' U' F' U F, F2L
27, R U' R' U R U' R', F2L
28, y L' U L U' L' U L, F2L
29, R' F R F' R' F R F', F2L
30, R U R' U' R U R', F2L
31, U' R' F R F' R U' R', F2L
32, R U R' U' R U R' U' R U R', F2L
33, U' R U' R' U2 R U' R', F2L
34, U R U R' U2 R U R', F2L
35, U' R U R' U F' U' F, F2L
36, U2 R' F R F' U2 R U R', F2L
37, R2 U2 F R2 F' U2 R' U R', F2L
38, R U R' U' R U2 R' U' R U R', F2L
39, R U R' U2 R U' R' U R U R', F2L
40, R U' R' F R U R' U' F' R U' R', F2L
41, R U R' U' R U' R' U2 y' R' U' R, F2L
`;

const OLL_RAW = `
1, R U2' R2' F R F' U2' R' F R F'
2, f U R U' R' S' U R U' R' F'
3, F U R U' R' F' U' F R U R' U' F'
4, F U R U' R' F' U F R U R' U' F'
5, r' U2' R U R' U r
6, r U2 R' U' R U' r'
7, r U R' U R U2' r'
8, R U2 R' U2 R' F R F'
9, R U2' R' U' S' R U' R' S
10, R U R' U R' F R F' R U2 R'
11, S R U R' U R U2 R' U2 S'
12, R' F R U R' F' R F U' F'
13, F U R U2 R' U' R U R' F'
14, R' F R U R' F' R F U' F'
15, r' U' r R' U' R U r' U r
16, r U r' R U R' U' r U' r'
17, F R' F' R U S' R U' R' S
18, R U R2' F' U' F U R U2' R' F R F'
19, S' R U R' S U' R' F R F'
20, S R' U' R U R U R U' R' S'
21, R U R' U R U' R' U R U2' R'
22, R U2' R2' U' R2 U' R2' U2' R
23, R2 D R' U2 R D' R' U2 R'
24, r U R' U' r' F R F'
25, R2 D R' U R D' R' U' R'
26, R U2 R' U' R U' R'
27, R U R' U R U2' R'
28, S' R U R' S R U' R'
29, R U R' U' R U' R' F' U' F R U R'
30, F U R U2 R' U' R U2 R' U' F'
31, R' U' F U R U' R' F' R
32, S R U R' U' R' F R f'
33, R U R' U' R' F R F'
34, f R f' U' r' U' R U M'
35, R U2' R2' F R F' R U2' R'
36, R' F' U' F2 U R U' R' F' R
37, F R U' R' U' R U R' F'
38, R U R' U R U' R' U' R' F R F'
39, f' r U r' U' r' F r S
40, R' F R U R' U' F' U R
41, R U R' U R U2 R' F R U R' U' F'
42, S' F R U R' U' F' U S
43, F' U' L' U L F
44, F U R U' R' F'
45, F R U R' U' F'
46, R' U' R' F R F' U R
47, F R' F' R U2 R U' R' U R U2' R'
48, F R U R' U' R U R' U' F'
49, R B' R2 F R2 B R2 F' R
50, R' F R2 B' R2 F' R2 B R'
51, f R U R' U' R U R' U' f'
52, R' F' U' F U' R U R' U R
53, r' U2 R U R' U' R U R' U r
54, r U R' U R U' R' U R U2 r'
55, R' F U R U' R2' F' R2 U R' U' R
56, f U R U' R' U R U' R' S' U R U' R' F'
57, R U R' S' R U' R' S
`;

const PLL_RAW = `
Aa, x R' U R' D2 R U' R' D2 R2 x'
Ab, x R2 D2 R U R' D2 R U' R x'
E, x' R U' R' D R U R' D' R U R' D R U' R' D' x
F, R' F R f' R' F R2 U R' U' R' F' R2 U R' S
Ga, R2 U R' U R' U' R U' R2 D U' R' U R D'
Gb, R' U' R U D' R2 U R' U R U' R U' R2 D
Gc, R2 F2 R U2 R U2 R' F R U R' U' R' F R2
Gd, R U R' U' D R2 U' R U' R' U R' U R2 D'
H, M2 U M2 U2 M2 U M2
Ja, L' U' L F L' U' L U L F' L2 U L
Jb, R U R' F' R U R' U' R' F R2 U' R'
Na, z U R' D R2 U' R D' U R' D R2 U' R D' z'
Nb, R' U R' F R F' R U' R' F' U F R U R' U' R
Ra, R U' R2 D' R U R' D R U' R U' R' U R U R'
Rb, R' U2 R U2 R' F R U R' U' R' F' R2
T, R U R' U' R' F R2 U' R' U' R U R' F'
Ua, R U' R U R U R U' R' U' R2
Ub, R2' U R U R' U' R3 U' R' U R'
V, R' U R U' R' f' U' R U2 R' U' R U' R' f R
Y, F R U' R' U' R U R' F' R U R' U' R' F R F'
Z, M2 U M2 U M' U2 M2 U2 M'
`;

// F2L cases are de-rotated to plain RUFBLD moves (no y rotations or d moves)
export const F2L_DB: AlgEntry[] = parsePresetString(F2L_RAW, SolvedState.F2L, true);

// OLL and PLL keep original notation
export const OLL_DB: AlgEntry[] = parsePresetString(OLL_RAW, SolvedState.OLL, false);
export const PLL_DB: AlgEntry[] = parsePresetString(PLL_RAW, SolvedState.FULL, false);
