import { Alg, AlgLeaf } from 'cubing/alg';

class CTAlg extends Alg {
  constructor(algString: string) {
    super(algString);
  }

  private mirrorMoveOverM(move: string): string {
    const faceMap: { [key: string]: string } = {
      'R': 'L', 'L': 'R',
      'r': 'l', 'l': 'r'
    };

    return move.replace(/([RrLl])(\d*)('?)/, (_, face, count, prime) => {
      const newFace = faceMap[face] || face;
      const newPrime = prime === '\'' ? '' : '\'';
      return `${newFace}${count}${newPrime}`;
    }).replace(/([UDFBESudfbyz])(\d*)('?)/, (_, face, count, prime) => {
      const newPrime = prime === '\'' ? '' : '\'';
      return `${face}${count}${newPrime}`;
    });
  }

  private mirrorMoveOverS(move: string): string {
    const faceMap: { [key: string]: string } = {
      'F': 'B', 'B': 'F',
      'f': 'b', 'b': 'f'
    };

    return move.replace(/([FBfb])(\d*)('?)/, (_, face, count, prime) => {
      const newFace = faceMap[face] || face;
      const newPrime = prime === '\'' ? '' : '\'';
      return `${newFace}${count}${newPrime}`;
    }).replace(/([UDLRMEudlryx])(\d*)('?)/, (_, face, count, prime) => {
      const newPrime = prime === '\'' ? '' : '\'';
      return `${face}${count}${newPrime}`;
    });
  }

  mirror(): CTAlg {
    const mirroredMoves = Array.from(this.experimentalExpand())
      .map(node => this.mirrorMoveOverM((node as AlgLeaf).toString()));
    return new CTAlg(mirroredMoves.join(' '));
  }

  mirrorOverS(): CTAlg {
    const mirroredMoves = Array.from(this.experimentalExpand())
      .map(node => this.mirrorMoveOverS((node as AlgLeaf).toString()));
    return new CTAlg(mirroredMoves.join(' '));
  }
}

export { CTAlg };
