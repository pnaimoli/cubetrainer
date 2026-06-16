import { Alg, AlgSet, Settings } from './interfaces';

export type ShuffleQueue = string[]; // ordered list of alg names remaining in shuffle

export function buildShuffleQueue(algs: Alg[]): ShuffleQueue {
  const names = algs.map(a => a.name);
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return names;
}

export type NextAlgResult = {
  alg: Alg;
  shuffleQueue: ShuffleQueue;
};

export function getNextAlg(
  currentAlg: Alg,
  algSet: AlgSet,
  settings: Pick<Settings, 'playlistMode' | 'loopMode'>,
  shuffleQueue: ShuffleQueue,
): NextAlgResult {
  const { playlistMode, loopMode } = settings;

  if (loopMode === 'loop1') {
    return { alg: currentAlg, shuffleQueue };
  }

  if (playlistMode === 'ordered') {
    const idx = algSet.algs.findIndex(a => a.name === currentAlg.name);
    const isLast = idx === algSet.algs.length - 1;
    if (isLast && loopMode === 'no loop') {
      return { alg: currentAlg, shuffleQueue };
    }
    return { alg: algSet.algs[(idx + 1) % algSet.algs.length], shuffleQueue };
  }

  if (playlistMode === 'shuffle') {
    let queue = shuffleQueue;
    if (queue.length === 0) {
      if (loopMode === 'no loop') {
        return { alg: currentAlg, shuffleQueue: [] };
      }
      queue = buildShuffleQueue(algSet.algs);
    }
    const nextAlg = algSet.algs.find(a => a.name === queue[0]) ?? currentAlg;
    return { alg: nextAlg, shuffleQueue: queue.slice(1) };
  }

  // random
  const idx = Math.floor(Math.random() * algSet.algs.length);
  return { alg: algSet.algs[idx], shuffleQueue };
}
