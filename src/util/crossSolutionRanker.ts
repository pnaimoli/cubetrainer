import { CrossSolution, solveGenRestricted, faceCharToIndex } from './crossSolver';
import { KPattern } from 'cubing/kpuzzle';

export interface RankedSolution {
  solution: string;   // rewritten moves
  rotation: string;   // "" | "y" | "y'" | "y2"
  genCount: number;
  qtm: number;
}

export interface GenGroup {
  genCount: number;
  moveCount: number;
  solutions: RankedSolution[];
}

// Y-axis rotation rewrites (preserves D cross)
const Y_REWRITES: Record<string, Record<string, string>> = {
  '': {},
  'y': { R: 'F', F: 'L', L: 'B', B: 'R' },
  "y'": { R: 'B', B: 'L', L: 'F', F: 'R' },
  'y2': { R: 'L', L: 'R', F: 'B', B: 'F' },
};

// Inverse y-rotation rewrites: map rewritten face back to original face
const Y_INVERSE: Record<string, Record<string, string>> = {
  '': {},
  'y': { F: 'R', L: 'F', B: 'L', R: 'B' },
  "y'": { B: 'R', L: 'B', F: 'L', R: 'F' },
  'y2': { L: 'R', R: 'L', B: 'F', F: 'B' },
};

const ROTATIONS = ['', 'y', "y'", 'y2'] as const;

function rewriteMove(move: string, rewriteMap: Record<string, string>): string {
  const face = move.charAt(0);
  const suffix = move.slice(1);
  const newFace = rewriteMap[face] ?? face;
  return newFace + suffix;
}

function rewriteSolution(solution: string, rotation: string): string {
  if (rotation === '') return solution;
  const map = Y_REWRITES[rotation];
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

// All 6 faces
const ALL_FACES = ['R', 'L', 'U', 'D', 'F', 'B'];

// Generate all combinations of n items from arr
function combinations<T>(arr: T[], n: number): T[][] {
  if (n === 0) return [[]];
  if (arr.length < n) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, n - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, n);
  return [...withFirst, ...withoutFirst];
}

/**
 * For a single CrossSolution, try all 4 y-rotations and pick the single
 * best representative: lowest gen count, then fewest L/B moves, then lowest QTM.
 */
function bestRotation(sol: CrossSolution): RankedSolution {
  let best: RankedSolution | null = null;
  for (const rotation of ROTATIONS) {
    const rewritten = rewriteSolution(sol.solution, rotation);
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

/**
 * Rank cross solutions and find gen-restricted alternatives.
 *
 * Returns GenGroups sorted by genCount DESC (highest gen first = optimal).
 * Each group contains deduplicated solutions sorted by LB penalty then QTM.
 */
export function rankCrossSolutions(
  solutions: CrossSolution[],
  scrambledPattern?: KPattern,
): GenGroup[] {
  // Step 1: For each solution, pick best y-rotation (dedup rotation equivalents)
  const bestPerSolution: RankedSolution[] = [];
  const seen = new Set<string>();
  for (const sol of solutions) {
    if (!sol.solution) continue;
    const best = bestRotation(sol);
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

      for (const rotation of ROTATIONS) {
        const inverseMap = Y_INVERSE[rotation];

        for (const faces of faceCombos) {
          const actualFaces = new Set(faces.map(f => {
            const actual = inverseMap[f] ?? f;
            return faceCharToIndex(actual);
          }));

          // Must include D (face index 3) for cross
          if (!actualFaces.has(3)) continue;

          const result = solveGenRestricted(scrambledPattern, actualFaces);
          if (result && result.solution) {
            const rewritten = rewriteSolution(result.solution, rotation);
            // Dedup: pick best rotation for this underlying solution
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
        // Find the canonical form: try all rotations, pick lexicographically smallest
        let canonKey = rs.solution;
        let best = rs;
        for (const rot of ROTATIONS) {
          if (rot === rs.rotation) continue;
          // We need to un-rotate then re-rotate to get the other variant
          // Actually, we can just compute all 4 rotations of the rewritten solution
          // and pick the one with fewest L/B
          const inverseMap = Y_INVERSE[rs.rotation];
          const originalSol = rs.rotation ? rs.solution.split(' ').filter(Boolean).map(m => rewriteMove(m, inverseMap)).join(' ') : rs.solution;
          const variant = rewriteSolution(originalSol, rot);
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

  // Sort groups by genCount DESC (highest gen first = optimal)
  groups.sort((a, b) => b.genCount - a.genCount);

  return groups;
}
