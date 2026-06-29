export const ALG_PRESETS: { [key: string]: string } = {
	"PLL": `
Aa, x (R' U R') D2 (R U' R') D2 R2 x'
Ab, x R2 D2 (R U R') D2 (R U' R) x'
E,  x' R U' R' D R U R' D' R U R' D R U' R' D' x
F,  R' F R f' R' F R2 U R' U' R' F' R2 U R' S
Ga, R2 U R' U R' U' R U' R2 D U' R' U R D'
Gb, R' U' R U D' R2 U R' U R U' R U' R2 D
Gc, R2 F2 R U2 R U2 R' F R U R' U' R' F R2
Gd, R U R' U' D R2 U' R U' R' U R' U R2 D'
H,  M2 U M2 U2 M2 U M2
Ja, L' U' L F L' U' L U L F' L2 U L
Jb, R U R' F' R U R' U' R' F R2 U' R'
Na, z U R' D R2 U' R D' U R' D R2 U' R D' z'
Nb, R' U R' F R F' R U' R' F' U F R U R' U' R
Ra, R U' R2 D' R U R' D R U' R U' R' U R U R'
Rb, R' U2 R U2 R' F R U R' U' R' F' R2
T,  R U R' U' R' F R2 U' R' U' R U R' F'
Ua, R U' R U R U R U' R' U' R2
Ub, R2' U R U R' U' R3 U' R' U R'
V,  R' U R U' R' f' U' R U2 R' U' R U' R' f R
Y,  F R (U' R' U') (R U R' F') (R U R' U') (R' F R F')
Z,  M2 U M2 U M' U2 M2 U2 M'
`,

	"F2L": `
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
`,

	"OLL": `
1, R U2' R2' F R F' U2' R' F R F', OLL
2, f U R U' R' S' U R U' R' F', OLL
3, F U R U' R' F' U' F R U R' U' F', OLL
4, F U R U' R' F' U F R U R' U' F', OLL
5, r' U2' R U R' U r, OLL
6, r U2 R' U' R U' r', OLL
7, r U R' U R U2' r', OLL
8, R U2 R' U2 R' F R F', OLL
9, R U2' R' U' S' R U' R' S, OLL
10, R U R' U R' F R F' R U2 R', OLL
11, S R U R' U R U2 R' U2 S', OLL
12, R' F R U R' F' R F U' F', OLL
13, F U R U2 R' U' R U R' F', OLL
14, R' F R U R' F' R F U' F', OLL
15, r' U' r R' U' R U r' U r, OLL
16, r U r' R U R' U' r U' r', OLL
17, F R' F' R U S' R U' R' S, OLL
18, R U R2' F' U' F U R U2' R' F R F', OLL
19, S' R U R' S U' R' F R F', OLL
20, S R' U' R U R U R U' R' S', OLL
21, R U R' U R U' R' U R U2' R', OLL
22, R U2' R2' U' R2 U' R2' U2' R, OLL
23, R2 D R' U2 R D' R' U2 R', OLL
24, r U R' U' r' F R F', OLL
25, R2 D R' U R D' R' U' R', OLL
26, R U2 R' U' R U' R', OLL
27, R U R' U R U2' R', OLL
28, S' R U R' S R U' R', OLL
29, R U R' U' R U' R' F' U' F R U R', OLL
30, F U R U2 R' U' R U2 R' U' F', OLL
31, R' U' F U R U' R' F' R, OLL
32, S R U R' U' R' F R f', OLL
33, R U R' U' R' F R F', OLL
34, f R f' U' r' U' R U M', OLL
35, R U2' R2' F R F' R U2' R', OLL
36, R' F' U' F2 U R U' R' F' R, OLL
37, F R U' R' U' R U R' F', OLL
38, R U R' U R U' R' U' R' F R F', OLL
39, f' r U r' U' r' F r S, OLL
40, R' F R U R' U' F' U R, OLL
41, R U R' U R U2 R' F R U R' U' F', OLL
42, S' F R U R' U' F' U S, OLL
43, F' U' L' U L F, OLL
44, F U R U' R' F', OLL
45, F R U R' U' F', OLL
46, R' U' R' F R F' U R, OLL
47, F R' F' R U2 R U' R' U R U2' R', OLL
48, F R U R' U' R U R' U' F', OLL
49, R B' R2 F R2 B R2 F' R, OLL
50, R' F R2 B' R2 F' R2 B R', OLL
51, f R U R' U' R U R' U' f', OLL
52, R' F' U' F U' R U R' U R, OLL
53, r' U2 R U R' U' R U R' U r, OLL
54, r U R' U R U' R' U R U2 r', OLL
55, R' F U R U' R2' F' R2 U R' U' R, OLL
56, f U R U' R' U R U' R' S' U R U' R' F', OLL
57, R U R' S' R U' R' S, OLL
`,

	"PLL Hard Recognition": `
Ua, U R U' R U R U R U' R' U' R2
Ub, R2' U R U R' U' R3 U' R' U R'
T-1, R U R' U' R' F R2 U' R' U' R U R' F'
T-2, U' R U R' U' R' F R2 U' R' U' R U R' F'
Aa-1, x (R' U R') D2 (R U' R') D2 R2 x'
Aa-2, U' x (R' U R') D2 (R U' R') D2 R2 x'
Ab-1, x R2 D2 (R U R') D2 (R U' R) x'
Ab-2, U' x R2 D2 (R U R') D2 (R U' R) x'
Ra-1, R U' R2 D' R U R' D R U' R U' R' U R U R'
Ra-2, U' R U' R2 D' R U R' D R U' R U' R' U R U R'
Ra-3, U R U' R2 D' R U R' D R U' R U' R' U R U R'
Rb-1, R' U2 R U2 R' F R U R' U' R' F' R2
Rb-2, U' R' U2 R U2 R' F R U R' U' R' F' R2
Rb-3, U2 R' U2 R U2 R' F R U R' U' R' F' R2
F-1, R' F R f' R' F R2 U R' U' R' F' R2 U R' S
F-2, U' R' F R f' R' F R2 U R' U' R' F' R2 U R' S
V, U' R' U R U' R' f' U' R U2 R' U' R U' R' f R
Y, U2 F R (U' R' U') (R U R' F') (R U R' U') (R' F R F')
E-1, x' R U' R' D R U R' D' R U R' D R U' R' D' x
E-2, U' x' R U' R' D R U R' D' R U R' D R U' R' D' x
E-3, U2 x' R U' R' D R U R' D' R U R' D R U' R' D' x
E-4, U x' R U' R' D R U R' D' R U R' D R U' R' D' x
Ga-1, R2 U R' U R' U' R U' R2 D U' R' U R D'
Ga-2, U' R2 U R' U R' U' R U' R2 D U' R' U R D'
Ga-3, U2 R2 U R' U R' U' R U' R2 D U' R' U R D'
Ga-4, U R2 U R' U R' U' R U' R2 D U' R' U R D'
Gb-1, R' U' R U D' R2 U R' U R U' R U' R2 D
Gb-2, U' R' U' R U D' R2 U R' U R U' R U' R2 D
Gb-3, U2 R' U' R U D' R2 U R' U R U' R U' R2 D
Gb-4, U R' U' R U D' R2 U R' U R U' R U' R2 D
Gc-1, R2 F2 R U2 R U2 R' F R U R' U' R' F R2
Gc-2, U' R2 F2 R U2 R U2 R' F R U R' U' R' F R2
Gc-3, U2 R2 F2 R U2 R U2 R' F R U R' U' R' F R2
Gc-4, U R2 F2 R U2 R U2 R' F R U R' U' R' F R2
Gd-1, R U R' U' D R2 U' R U' R' U R' U R2 D'
Gd-2, U' R U R' U' D R2 U' R U' R' U R' U R2 D'
Gd-3, U2 R U R' U' D R2 U' R U' R' U R' U R2 D'
Gd-4, U R U R' U' D R2 U' R U' R' U R' U R2 D'
`,

	"Advanced F2L": `
1, R' D' F' D R, CROSS | F2LFR
2, F D R D' F', CROSS | F2LFR
`,

	"Connected F2L": `
1, R U2 R' U R U2 R' U F' U' F, F2L
2, r U' r' U2 r U r' R U R', F2L
3, R U' R' U R U' R' U2' R U' R', F2L
4, R U' R' U' R U R' U2' R U' R', F2L
5, F' U F U' R U' R', F2L
6, R U R' F U R U' R' F' R U R', F2L
7, U R U' R' U' R U' R' U R U' R', F2L
8, U R U' R' U R U' R' U R U' R', F2L
9, F' U F U2' R U R' U, F2L
`,
};
