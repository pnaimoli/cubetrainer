import { KPattern } from 'cubing/kpuzzle';
import { SolvedState } from './interfaces';

interface StickerMask {
  orbits: {
    EDGES: { pieces: { facelets: string[] }[] };
    CORNERS: { pieces: { facelets: string[] }[] };
    CENTERS: { pieces: { facelets: string[] }[] };
  };
}

const R = { facelets: new Array(5).fill("regular") };
const I = { facelets: new Array(5).fill("ignored") };
const R1 = { ...I, facelets: [...I.facelets] }; R1.facelets[0] = "regular";

const maskNONE : StickerMask = {
  orbits: {
    EDGES: { pieces: new Array(12).fill(I) },
    CORNERS: { pieces: new Array(8).fill(I) },
    CENTERS: { pieces: new Array(6).fill(I) },
  }
};

const maskFULL : StickerMask = {
  orbits: {
    EDGES: { pieces: new Array(12).fill(R) },
    CORNERS: { pieces: new Array(8).fill(R) },
    CENTERS: { pieces: new Array(6).fill(R) },
  }
};

const maskCROSS : StickerMask = {
  orbits: {
    EDGES: {
      pieces: [I, I, I, I, R, R, R, R, I, I, I, I],
    },
    CORNERS: {
      pieces: [I, I, I, I, I, I, I, I],
    },
    CENTERS: {
      pieces: [R, R, R, R, R, R],
    },
  }
};

const maskF2LFR : StickerMask = {
  orbits: {
    EDGES: {
      pieces: [I, I, I, I, I, I, I, I, R, I, I, I],
    },
    CORNERS: {
      pieces: [I, I, I, I, R, I, I, I],
    },
    CENTERS: {
      pieces: [R, R, R, R, R, R],
    },
  }
};

const maskF2LFL : StickerMask = {
  orbits: {
    EDGES: {
      pieces: [I, I, I, I, I, I, I, I, I, R, I, I],
    },
    CORNERS: {
      pieces: [I, I, I, I, I, R, I, I],
    },
    CENTERS: {
      pieces: [R, R, R, R, R, R],
    },
  }
};

const maskF2LBL : StickerMask = {
  orbits: {
    EDGES: {
      pieces: [I, I, I, I, I, I, I, I, I, I, I, R],
    },
    CORNERS: {
      pieces: [I, I, I, I, I, I, R, I],
    },
    CENTERS: {
      pieces: [R, R, R, R, R, R],
    },
  }
};

const maskF2LBR : StickerMask = {
  orbits: {
    EDGES: {
      pieces: [I, I, I, I, I, I, I, I, I, I, R, I],
    },
    CORNERS: {
      pieces: [I, I, I, I, I, I, I, R],
    },
    CENTERS: {
      pieces: [R, R, R, R, R, R],
    },
  }
};

const maskTOPEDGES : StickerMask = {
  orbits: {
    EDGES: {
      pieces: [R1, R1, R1, R1, I, I, I, I, I, I, I, I],
    },
    CORNERS: {
      pieces: [I, I, I, I, I, I, I, I],
    },
    CENTERS: {
      pieces: [R, R, R, R, R, R],
    },
  }
};

const maskTOPCORNERS : StickerMask = {
  orbits: {
    EDGES: {
      pieces: [I, I, I, I, I, I, I, I, I, I, I, I],
    },
    CORNERS: {
      pieces: [R1, R1, R1, R1, I, I, I, I],
    },
    CENTERS: {
      pieces: [R, R, R, R, R, R],
    },
  }
};

export const combineMasks = (mask1: StickerMask, mask2: StickerMask): StickerMask => {
  const combineFacelets = (facelets1: string[], facelets2: string[]): string[] => {
    return facelets1.map((facelet, index) => (facelet === 'regular' || facelets2[index] === 'regular') ? 'regular' : 'ignored');
  };

  const combinePieces = (pieces1: { facelets: string[] }[], pieces2: { facelets: string[] }[]): { facelets: string[] }[] => {
    return pieces1.map((piece, index) => ({ facelets: combineFacelets(piece.facelets, pieces2[index].facelets) }));
  };

  return {
    orbits: {
      EDGES: { pieces: combinePieces(mask1.orbits.EDGES.pieces, mask2.orbits.EDGES.pieces) },
      CORNERS: { pieces: combinePieces(mask1.orbits.CORNERS.pieces, mask2.orbits.CORNERS.pieces) },
      CENTERS: { pieces: combinePieces(mask1.orbits.CENTERS.pieces, mask2.orbits.CENTERS.pieces) },
    },
  };
};

// @ts-ignore
export const generateStickerMask = (kpattern: KPattern, solvedState: number): StickerMask => {
  if (solvedState & SolvedState.FULL) return maskFULL;

  let currentMask = maskNONE;

  if (solvedState & SolvedState.CROSS) {
    currentMask = combineMasks(currentMask, maskCROSS);
  }
  if (solvedState & SolvedState.F2LFR) {
    currentMask = combineMasks(currentMask, maskF2LFR);
  }
  if (solvedState & SolvedState.F2LFL) {
    currentMask = combineMasks(currentMask, maskF2LFL);
  }
  if (solvedState & SolvedState.F2LBL) {
    currentMask = combineMasks(currentMask, maskF2LBL);
  }
  if (solvedState & SolvedState.F2LBR) {
    currentMask = combineMasks(currentMask, maskF2LBR);
  }
  if (solvedState & SolvedState.TOPEDGES) {
    currentMask = combineMasks(currentMask, maskTOPEDGES);
  }
  if (solvedState & SolvedState.TOPCORNERS) {
    currentMask = combineMasks(currentMask, maskTOPCORNERS);
  }

  return currentMask;
};
