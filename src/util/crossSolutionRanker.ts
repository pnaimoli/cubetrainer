import { CrossSolution, solveGenRestricted, faceCharToIndex } from './crossSolver';
import { KPattern } from 'cubing/kpuzzle';

export interface RankedSolution {
  solution: string;   // rewritten moves
  rotation: string;   // e.g. "" | "y" | "x2 y'"
  genCount: number;
  qtm: number;
}

export interface GenGroup {
  genCount: number;
  moveCount: number;
  solutions: RankedSolution[];
}

// All solutions are displayed with cross on the D face.
// For non-D crosses, a mandatory base rotation puts the cross face on D,
// then y rotations are used for gen optimization.

const FACE_NAMES = ['U', 'L', 'F', 'R', 'B', 'D'] as const;

// Rotation to put each cross face on the D position
const BASE_ROTATION: Record<string, string> = {
  D: '', U: 'x2', F: "x'", B: 'x', R: 'z', L: "z'",
};

// How each base rotation remaps faces (solver frame -> display frame)
const BASE_REWRITE: Record<string, Record<string, string>> = {
  D: {},
  U: { U: 'D', D: 'U', F: 'B', B: 'F' },
  F: { U: 'F', F: 'D', D: 'B', B: 'U' },
  B: { U: 'B', B: 'D', D: 'F', F: 'U' },
  R: { U: 'R', R: 'D', D: 'L', L: 'U' },
  L: { U: 'L', L: 'D', D: 'R', R: 'U' },
};

const Y_ROTATIONS = ['', 'y', "y'", 'y2'] as const;
const Y_REWRITES: Record<string, Record<string, string>> = {
  '': {},
  'y': { R: 'F', F: 'L', L: 'B', B: 'R' },
  "y'": { R: 'B', B: 'L', L: 'F', F: 'R' },
  'y2': { R: 'L', L: 'R', F: 'B', B: 'F' },
};

function composeFaceMap(first: Record<string, string>, second: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const face of FACE_NAMES) {
    const afterFirst = first[face] ?? face;
    const afterSecond = second[afterFirst] ?? afterFirst;
    if (afterSecond !== face) result[face] = afterSecond;
  }
  return result;
}

function invertFaceMap(map: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const face of FACE_NAMES) {
    const mapped = map[face] ?? face;
    if (mapped !== face) result[mapped] = face;
  }
  return result;
}

interface RotationEntry {
  label: string;
  rewrite: Record<string, string>;
  inverse: Record<string, string>;
}

const rotationCache = new Map<string, RotationEntry[]>();

function getRotationEntries(crossFace: string): RotationEntry[] {
  let entries = rotationCache.get(crossFace);
  if (entries) return entries;

  const base = BASE_ROTATION[crossFace] ?? '';
  const baseRewrite = BASE_REWRITE[crossFace] ?? {};

  entries = Y_ROTATIONS.map(yRot => {
    const composed = composeFaceMap(baseRewrite, Y_REWRITES[yRot]);
    const label = [base, yRot].filter(Boolean).join(' ');
    return { label, rewrite: composed, inverse: invertFaceMap(composed) };
  });

  rotationCache.set(crossFace, entries);
  return entries;
}

function rewriteMove(move: string, rewriteMap: Record<string, string>): string {
  const face = move.charAt(0);
  const suffix = move.slice(1);
  return (rewriteMap[face] ?? face) + suffix;
}

function rewriteSolution(solution: string, rewriteMap: Record<string, string>): string {
  if (Object.keys(rewriteMap).length === 0) return solution;
  return solution.split(' ').filter(Boolean).map(m => rewriteMove(m, rewriteMap)).join(' ');
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

function bestRotation(sol: CrossSolution, entries: RotationEntry[]): RankedSolution {
  let best: RankedSolution | null = null;
  for (const entry of entries) {
    const rewritten = rewriteSolution(sol.solution, entry.rewrite);
    const candidate: RankedSolution = {
      solution: rewritten,
      rotation: entry.label,
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
  const entries = getRotationEntries(crossFace);
  const mustIncludeFaceIdx = faceCharToIndex(crossFace);

  // Step 1: For each solution, pick best rotation (dedup rotation equivalents)
  const bestPerSolution: RankedSolution[] = [];
  const seen = new Set<string>();
  for (const sol of solutions) {
    if (!sol.solution) continue;
    const best = bestRotation(sol, entries);
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

      for (const entry of entries) {
        for (const faces of faceCombos) {
          const actualFaces = new Set(faces.map(f => {
            const actual = entry.inverse[f] ?? f;
            return faceCharToIndex(actual);
          }));

          // Must include the cross face
          if (!actualFaces.has(mustIncludeFaceIdx)) continue;

          const result = solveGenRestricted(scrambledPattern, actualFaces, 4, crossFace);
          if (result && result.solution) {
            const rewritten = rewriteSolution(result.solution, entry.rewrite);
            if (!genSeen.has(rewritten)) {
              genSeen.add(rewritten);
              genSolutions.push({
                solution: rewritten,
                rotation: entry.label,
                genCount: countGens(rewritten),
                qtm: computeQTM(rewritten),
              });
            }
          }
        }
      }

      // Dedup rotation-equivalent solutions
      const canonical = new Map<string, RankedSolution>();
      for (const rs of genSolutions) {
        const currentEntry = entries.find(e => e.label === rs.rotation)!;
        // Recover original (solver-frame) solution
        const originalSol = rewriteSolution(rs.solution, currentEntry.inverse);

        let canonKey = '';
        let best: RankedSolution = rs;
        for (const entry of entries) {
          const variant = rewriteSolution(originalSol, entry.rewrite);
          if (!canonKey || variant < canonKey) canonKey = variant;
          const ranked: RankedSolution = {
            solution: variant,
            rotation: entry.label,
            genCount: countGens(variant),
            qtm: computeQTM(variant),
          };
          if (compareSolutions(ranked, best) < 0) best = ranked;
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
