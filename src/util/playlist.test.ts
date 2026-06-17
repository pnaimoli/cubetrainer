import { expect } from 'chai';
import { Alg, AlgSet, SolvedState } from './interfaces';
import { getNextAlg, buildShuffleQueue, ShuffleQueue } from './playlist';

const makeAlg = (name: string): Alg => ({
  name,
  alg: [],
  solved: SolvedState.FULL,
});

const algSet: AlgSet = {
  id: 'test-id',
  name: 'Test',
  algs: [makeAlg('A'), makeAlg('B'), makeAlg('C')],
};

const emptyQueue: ShuffleQueue = [];

describe('getNextAlg - ordered', () => {
  it('advances to the next alg in sequence', () => {
    const { alg } = getNextAlg(algSet.algs[0], algSet, { playlistMode: 'ordered', loopMode: 'loop' }, emptyQueue);
    expect(alg.name).to.equal('B');
  });

  it('wraps around to first alg with loop mode', () => {
    const { alg } = getNextAlg(algSet.algs[2], algSet, { playlistMode: 'ordered', loopMode: 'loop' }, emptyQueue);
    expect(alg.name).to.equal('A');
  });

  it('stays on last alg with no loop mode', () => {
    const { alg } = getNextAlg(algSet.algs[2], algSet, { playlistMode: 'ordered', loopMode: 'no loop' }, emptyQueue);
    expect(alg.name).to.equal('C');
  });

  it('does not stay on intermediate alg with no loop mode', () => {
    const { alg } = getNextAlg(algSet.algs[0], algSet, { playlistMode: 'ordered', loopMode: 'no loop' }, emptyQueue);
    expect(alg.name).to.equal('B');
  });

  it('stays on same alg with loop1 mode', () => {
    const { alg } = getNextAlg(algSet.algs[0], algSet, { playlistMode: 'ordered', loopMode: 'loop1' }, emptyQueue);
    expect(alg.name).to.equal('A');
  });
});

describe('getNextAlg - shuffle', () => {
  it('picks the first alg from the queue', () => {
    const queue = ['C', 'A', 'B'];
    const { alg, shuffleQueue } = getNextAlg(algSet.algs[0], algSet, { playlistMode: 'shuffle', loopMode: 'loop' }, queue);
    expect(alg.name).to.equal('C');
    expect(shuffleQueue).to.deep.equal(['A', 'B']);
  });

  it('rebuilds the queue when empty with loop mode', () => {
    const { alg, shuffleQueue } = getNextAlg(algSet.algs[0], algSet, { playlistMode: 'shuffle', loopMode: 'loop' }, emptyQueue);
    expect(algSet.algs.map(a => a.name)).to.include(alg.name);
    expect(shuffleQueue.length).to.equal(algSet.algs.length - 1);
  });

  it('stays on current alg when queue is empty with no loop mode', () => {
    const { alg, shuffleQueue } = getNextAlg(algSet.algs[1], algSet, { playlistMode: 'shuffle', loopMode: 'no loop' }, emptyQueue);
    expect(alg.name).to.equal('B');
    expect(shuffleQueue).to.deep.equal([]);
  });

  it('stays on same alg with loop1 regardless of queue', () => {
    const { alg } = getNextAlg(algSet.algs[1], algSet, { playlistMode: 'shuffle', loopMode: 'loop1' }, ['C']);
    expect(alg.name).to.equal('B');
  });
});

describe('getNextAlg - random', () => {
  it('returns a valid alg from the set', () => {
    const names = algSet.algs.map(a => a.name);
    for (let i = 0; i < 20; i++) {
      const { alg } = getNextAlg(algSet.algs[0], algSet, { playlistMode: 'random', loopMode: 'loop' }, emptyQueue);
      expect(names).to.include(alg.name);
    }
  });
});

describe('buildShuffleQueue', () => {
  it('contains all alg names exactly once', () => {
    const queue = buildShuffleQueue(algSet.algs);
    expect(queue.sort()).to.deep.equal(['A', 'B', 'C']);
  });
});
