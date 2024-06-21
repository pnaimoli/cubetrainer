import { Alg } from 'cubing/alg';

class CTAlg extends Alg {
  constructor(algString: string) {
    super(algString);
  }

  mirror(): CTAlg {
    const mirroredMoves = this.moves.map(move => {
      switch (move) {
        case 'R': return 'L';
        case 'R\'': return 'L\'';
        case 'R2': return 'L2';
        case 'L': return 'R';
        case 'L\'': return 'R\'';
        case 'L2': return 'R2';
        case 'U': return 'U\'';
        case 'U\'': return 'U';
        case 'U2': return 'U2';
        case 'D': return 'D\'';
        case 'D\'': return 'D';
        case 'D2': return 'D2';
        case 'F': return 'F\'';
        case 'F\'': return 'F';
        case 'F2': return 'F2';
        case 'B': return 'B\'';
        case 'B\'': return 'B';
        case 'B2': return 'B2';
        case 'M': return 'M\'';
        case 'M\'': return 'M';
        case 'M2': return 'M2';
        case 'S': return 'S\'';
        case 'S\'': return 'S';
        case 'S2': return 'S2';
        case 'E': return 'E\'';
        case 'E\'': return 'E';
        case 'E2': return 'E2';
        case 'x': return 'x\'';
        case 'x\'': return 'x';
        case 'x2': return 'x2';
        case 'y': return 'y\'';
        case 'y\'': return 'y';
        case 'y2': return 'y2';
        case 'z': return 'z\'';
        case 'z\'': return 'z';
        case 'z2': return 'z2';
        default: return move;
      }
    });
    return new CTAlg(mirroredMoves.join(' '));
  }

  mirrorOverS(): CTAlg {
    const mirroredMoves = this.moves.map(move => {
      switch (move) {
        case 'F': return 'B';
        case 'F\'': return 'B\'';
        case 'F2': return 'B2';
        case 'B': return 'F';
        case 'B\'': return 'F\'';
        case 'B2': return 'F2';
        case 'U': return 'U\'';
        case 'U\'': return 'U';
        case 'U2': return 'U2';
        case 'D': return 'D\'';
        case 'D\'': return 'D';
        case 'D2': return 'D2';
        case 'L': return 'L\'';
        case 'L\'': return 'L';
        case 'L2': return 'L2';
        case 'R': return 'R\'';
        case 'R\'': return 'R';
        case 'R2': return 'R2';
        case 'M': return 'M\'';
        case 'M\'': return 'M';
        case 'M2': return 'M2';
        case 'S': return 'S\'';
        case 'S\'': return 'S';
        case 'S2': return 'S2';
        case 'E': return 'E\'';
        case 'E\'': return 'E';
        case 'E2': return 'E2';
        case 'x': return 'x\'';
        case 'x\'': return 'x';
        case 'x2': return 'x2';
        case 'y': return 'y\'';
        case 'y\'': return 'y';
        case 'y2': return 'y2';
        case 'z': return 'z\'';
        case 'z\'': return 'z';
        case 'z2': return 'z2';
        default: return move;
      }
    });
    return new CTAlg(mirroredMoves.join(' '));
  }
}

export { CTAlg };
