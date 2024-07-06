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
1, R U2 R2' F R F' U2 R' F R F', OLL
2, F R U R' U' F' f R U R' U' f', OLL
3, U' f R U R' U' f' U' F R U R' U' F', OLL
4, U' f R U R' U' f' U F R U R' U' F', OLL
5, r' U2 R U R' U r, OLL
6, r U2 R' U' R U' r', OLL
7, r U R' U R U2 r', OLL
8, U2 r' U' R U' R' U2 r, OLL
9, U R U R' U' R' F R2 U R' U' F', OLL
10, R U R' U R' F R F' R U2 R', OLL
11, r' R2 U R' U R U2 R' U M', OLL
12, F R U R' U' F' U F R U R' U' F', OLL
13, r U' r' U' r U r' F' U F, OLL
14, R' F R U R' F' R F U' F', OLL
15, U2 l' U' l L' U' L U l' U l, OLL
16, r U r' R U R' U' r U' r', OLL
17, R U R' U R' F R F' U2 R' F R F', OLL
18, r U R' U R U2 r2 U' R U' R' U2 r, OLL
19, M U R U R' U' M' R' F R F', OLL
20, M U R U R' U' M2 U R U' r', OLL
21, U R U2 R' U' R U R' U' R U' R', OLL
22, R U2 R2 U' R2 U' R2 U2 R, OLL
23, R2 D R' U2 R D' R' U2 R', OLL
24, r U R' U' r' F R F', OLL
25, U F' r U R' U' r' F R, OLL
26, U R U2 R' U' R U' R', OLL
27, R U R' U R U2 R', OLL
28, r U R' U' M U R U' R', OLL
29, M U R U R' U' R' F R F' M', OLL
30, U' r' D' r U' r' D r2 U' r' U r U r', OLL
31, R' U' F U R U' R' F' R, OLL
32, S R U R' U' R' F R f', OLL
33, R U R' U' R' F R F', OLL
34, U2 R U R' U' B' R' F R F' B, OLL
35, R U2 R2' F R F' R U2 R', OLL
36, U2 L' U' L U' L' U L U L F' L' F, OLL
37, F R U' R' U' R U R' F', OLL
38, R U R' U R U' R' U' R' F R F', OLL
39, U L F' L' U' L U F U' L', OLL
40, U R' F R U R' U' F' U R, OLL
41, U2 R U R' U R U2' R' F R U R' U' F', OLL
42, R' U' R U' R' U2 R F R U R' U' F', OLL
43, f' L' U' L U f, OLL
44, f R U R' U' f', OLL
45, F R U R' U' F', OLL
46, R' U' R' F R F' U R, OLL
47, F' L' U' L U L' U' L U F, OLL
48, F R U R' U' R U R' U' F', OLL
49, U2 r U' r2 U r2 U r2 U' r, OLL
50, r' U r2 U' r2' U' r2 U r', OLL
51, f R U R' U' R U R' U' f', OLL
52, R U R' U R d' R U' R' F', OLL
53, r' U' R U' R' U R U' R' U2 r, OLL
54, r U R' U R U' R' U R U2 r', OLL
55, R U2 R2 U' R U' R' U2 F R F', OLL
56, r U r' U R U' R' U R U' R' r U' r', OLL
57, R U R' U' M' U R U' r', OLL
`,

	"Advanced F2L": `
1, R' D' F' D R, CROSS | F2LFR
2, F D R D' F', CROSS | F2LFR
`,
};
