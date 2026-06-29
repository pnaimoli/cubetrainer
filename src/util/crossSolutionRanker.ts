import { CrossSolution, solveGenRestricted, faceCharToIndex } from './crossSolver';
import { KPattern } from 'cubing/kpuzzle';

export interface RankedSolution {
  solution: string;   // rewritten moves
  rotation: string;   // e.g. "" | "y" | "y'" | "y2"
  genCount: number;
  qtm: number;
}

export interface GenGroup {
  genCount: number;
  moveCount: number;
  solutions: RankedSolution[];
}

// Rotation rewrites per axis. Each axis has 4 rotations (identity + 3 non-trivial).
// The rewrite maps: if the solution has face X, replace it with rewriteMap[X].
// D/U cross: y-axis (preserves D and U)
// F/B cross: z-axis (preserves F and B)
// R/L cross: x-axis (preserves R and L)

interface RotationConfig {
  rotations: readonly string[];
  rewrites: Record<string, Record<string, string>>;
  inverses: Record<string, Record<string, string>>;
}

const Y_CONFIG: RotationConfig = {
  rotations: ['', 'y', "y'", 'y2'],
  rewrites: {
    '': {},
    'y': { R: 'F', F: 'L', L: 'B', B: 'R' },
    "y'": { R: 'B', B: 'L', L: 'F', F: 'R' },
    'y2': { R: 'L', L: 'R', F: 'B', B: 'F' },
  },
  inverses: {
    '': {},
    'y': { F: 'R', L: 'F', B: 'L', R: 'B' },
    "y'": { B: 'R', L: 'B', F: 'L', R: 'F' },
    'y2': { L: 'R', R: 'L', B: 'F', F: 'B' },
  },
};

const Z_CONFIG: RotationConfig = {
  rotations: ['', 'z', "z'", 'z2'],
  rewrites: {
    '': {},
    'z': { U: 'R', R: 'D', D: 'L', L: 'U' },
    "z'": { U: 'L', L: 'D', D: 'R', R: 'U' },
    'z2': { U: 'D', D: 'U', R: 'L', L: 'R' },
  },
  inverses: {
    '': {},
    'z': { R: 'U', D: 'R', L: 'D', U: 'L' },
    "z'": { L: 'U', D: 'L', R: 'D', U: 'R' },
    'z2': { D: 'U', U: 'D', L: 'R', R: 'L' },
  },
};

const X_CONFIG: RotationConfig = {
  rotations: ['', 'x', "x'", 'x2'],
  rewrites: {
    '': {},
    'x': { U: 'F', F: 'D', D: 'B', B: 'U' },
    "x'": { U: 'B', B: 'D', D: 'F', F: 'U' },
    'x2': { U: 'D', D: 'U', F: 'B', B: 'F' },
  },
  inverses: {
    '': {},
    'x': { F: 'U', D: 'F', B: 'D', U: 'B' },
    "x'": { B: 'U', D: 'B', F: 'D', U: 'F' },
    'x2': { D: 'U', U: 'D', B: 'F', F: 'B' },
  },
};

const CROSS_ROTATION_CONFIG: Record<string, RotationConfig> = {
  D: Y_CONFIG, U: Y_CONFIG,
  F: Z_CONFIG, B: Z_CONFIG,
  R: X_CONFIG, L: X_CONFIG,
};

function rewriteMove(move: string, rewriteMap: Record<string, string>): string {
  const face = move.charAt(0);
  const suffix = move.slice(1);
  const newFace = rewriteMap[face] ?? face;
  return newFace + suffix;
}

function rewriteSolution(solution: string, rotation: string, config: RotationConfig): string {
  if (rotation === '') return solution;
  const map = config.rewrites[rotation];
  return solution.split(' ').filter(Boolean).map(m => rewriteMove(m, map)).join(' ');
}

function countGens(solution: string): number {
  const faces = new Set<string>();
  for (const move of solution.split(' ').filter(Boolean)) {
    faces.add(move.charAt(0));
  }
  return faces.size;
}

function countLBMoves(solution: string): number {
  let count = 0;
  for (const move of solution.split(' ').filter(Boolean)) {
    const face = move.charAt(0);
    if (face === 'L' || face === 'B') count++;
  }
  return count;
}

function computeQTM(solution: string): number {
  let qtm = 0;
  for (const move of solution.split(' ').filter(Boolean)) {
    qtm += move.endsWith('2') ? 2 : 1;
  }
  return qtm;
}

const ALL_FACES = ['R', 'L', 'U', 'D', 'F', 'B'];

function combinations<T>(arr: T[], n: number): T[][] {
  if (n === 0) return [[]];
  if (arr.length < n) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, n - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, n);
  return [...withFirst, ...withoutFirst];
}

function bestRotation(sol: CrossSolution, config: RotationConfig): RankedSolution {
  let best: RankedSolution | null = null;
  for (const rotation of config.rotations) {
    const rewritten = rewriteSolution(sol.solution, rotation, config);
    const candidate: RankedSolution = {
      solution: rewritten,
      rotation,
      genCount: countGens(rewritten),
      qtm: computeQTM(rewritten),
    };
    if (!best || compareSolutions(candidate, best) < 0) {
      best = candidate;
    }
  }
  return best!;
}

function compareSolutions(a: RankedSolution, b: RankedSolution): number {
  if (a.genCount !== b.genCount) return a.genCount - b.genCount;
  const aLB = countLBMoves(a.solution);
  const bLB = countLBMoves(b.solution);
  if (aLB !== bLB) return aLB - bLB;
  return a.qtm - b.qtm;
}

export function rankCrossSolutions(
  solutions: CrossSolution[],
  scrambledPattern?: KPattern,
  crossFace: string = 'D',
): GenGroup[] {
  const config = CROSS_ROTATION_CONFIG[crossFace] ?? Y_CONFIG;
  const mustIncludeFaceIdx = faceCharToIndex(crossFace);

  // Step 1: For each solution, pick best rotation (dedup rotation equivalents)
  const bestPerSolution: RankedSolution[] = [];
  const seen = new Set<string>();
  for (const sol of solutions) {
    if (!sol.solution) continue;
    const best = bestRotation(sol, config);
    if (!seen.has(best.solution)) {
      seen.add(best.solution);
      bestPerSolution.push(best);
    }
  }

  if (bestPerSolution.length === 0) return [];

  const bestGen = Math.min(...bestPerSolution.map(c => c.genCount));

  // Step 2: Build optimal gen group (only bestGen solutions)
  const optimalSolutions = bestPerSolution
    .filter(c => c.genCount === bestGen)
    .sort((a, b) => {
      const aLB = countLBMoves(a.solution);
      const bLB = countLBMoves(b.solution);
      if (aLB !== bLB) return aLB - bLB;
      return a.qtm - b.qtm;
    });

  const groups: GenGroup[] = [{
    genCount: bestGen,
    moveCount: solutions[0]?.moveCount ?? 0,
    solutions: optimalSolutions,
  }];

  // Step 3: Find lower-gen solutions via restricted search
  if (scrambledPattern && bestGen > 2) {
    for (let targetGen = bestGen - 1; targetGen >= Math.max(2, bestGen - 2); targetGen--) {
      const genSolutions: RankedSolution[] = [];
      const genSeen = new Set<string>();

      const faceCombos = combinations(ALL_FACES, targetGen);

      for (const rotation of config.rotations) {
        const inverseMap = config.inverses[rotation];

        for (const faces of faceCombos) {
          const actualFaces = new Set(faces.map(f => {
            const actual = inverseMap[f] ?? f;
            return faceCharToIndex(actual);
          }));

          // Must include the cross face
          if (!actualFaces.has(mustIncludeFaceIdx)) continue;

          const result = solveGenRestricted(scrambledPattern, actualFaces, 4, crossFace);
          if (result && result.solution) {
            const rewritten = rewriteSolution(result.solution, rotation, config);
            if (!genSeen.has(rewritten)) {
              genSeen.add(rewritten);
              genSolutions.push({
                solution: rewritten,
                rotation,
                genCount: countGens(rewritten),
                qtm: computeQTM(rewritten),
              });
            }
          }
        }
      }

      // Further dedup: different face combos under different rotations may produce
      // rotation-equivalent solutions. Group by canonical form.
      const canonical = new Map<string, RankedSolution>();
      for (const rs of genSolutions) {
        let canonKey = rs.solution;
        let best = rs;
        for (const rot of config.rotations) {
          if (rot === rs.rotation) continue;
          const inverseMap = config.inverses[rs.rotation];
          const originalSol = rs.rotation ? rs.solution.split(' ').filter(Boolean).map(m => rewriteMove(m, inverseMap)).join(' ') : rs.solution;
          const variant = rewriteSolution(originalSol, rot, config);
          if (variant < canonKey) canonKey = variant;
          const variantRanked: RankedSolution = {
            solution: variant,
            rotation: rot,
            genCount: countGens(variant),
            qtm: computeQTM(variant),
          };
          if (compareSolutions(variantRanked, best) < 0) best = variantRanked;
        }
        const existing = canonical.get(canonKey);
        if (!existing || compareSolutions(best, existing) < 0) {
          canonical.set(canonKey, best);
        }
      }

      const dedupedSolutions = Array.from(canonical.values())
        .filter(s => s.genCount === targetGen)
        .sort((a, b) => {
          const aLB = countLBMoves(a.solution);
          const bLB = countLBMoves(b.solution);
          if (aLB !== bLB) return aLB - bLB;
          return a.qtm - b.qtm;
        });

      if (dedupedSolutions.length > 0) {
        groups.push({
          genCount: targetGen,
          moveCount: dedupedSolutions[0].solution.split(' ').filter(Boolean).length,
          solutions: dedupedSolutions,
        });
      }
    }
  }

  groups.sort((a, b) => b.genCount - a.genCount);

  return groups;
}
