import { expect } from 'chai';
import { CTAlg } from '../CTAlg';

describe('CTAlg', () => {
  it('should mirror moves correctly', () => {
    const alg = new CTAlg("R U R' U'");
    const mirrored = alg.mirror().toString();
    expect(mirrored).to.equal("L' U' L U");
  });

  it('should mirror over S moves correctly', () => {
    const alg = new CTAlg("F R U R' U' F'");
    const mirrored = alg.mirrorOverS().toString();
    expect(mirrored).to.equal("B' R' U' R U B");
  });
});
