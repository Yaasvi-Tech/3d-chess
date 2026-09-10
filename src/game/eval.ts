/**
 * Static position evaluation shared by two consumers:
 *  - the UI (eval bar, advantage badges) — cheap, synchronous
 *  - the search engine in the web worker (piece-square tables + structure)
 *
 * All scores are expressed in pawns from White's point of view.
 */
import type { Color, PieceType } from './types';

export const PIECE_VALUE: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// prettier-ignore
export const PST: Record<PieceType, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

const FILES = 'abcdefgh';

export interface StaticEvalOptions {
  /** endgame king table (uses a simpler, safe-king-first profile) */
  endgame?: boolean;
  includeStructure?: boolean;
}

/**
 * Evaluate a FEN without allocating a Chess instance (hot path in the worker).
 */
export function evalFen(fen: string, opts: StaticEvalOptions = {}): number {
  const placement = fen.split(' ')[0];
  let score = 0;
  let rank = 7;
  let file = 0;
  let material = 0;
  const counts = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 } as Record<string, number>,
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 } as Record<string, number>,
  };
  const pawnFiles: Record<Color, number[]> = { w: [], b: [] };

  for (let i = 0; i < placement.length; i++) {
    const c = placement[i];
    if (c === '/') {
      rank--;
      file = 0;
      continue;
    }
    if (c >= '1' && c <= '8') {
      file += Number(c);
      continue;
    }
    const color: Color = c === c.toUpperCase() ? 'w' : 'b';
    const type = c.toLowerCase() as PieceType;
    const idx = color === 'w' ? rank * 8 + file : (7 - rank) * 8 + file;
    const table = PST[type] ?? PST.p;
    const sign = color === 'w' ? 1 : -1;
    if (type !== 'k') {
      material += (PIECE_VALUE[type] - 100) * sign;
      counts[color][type]++;
    }
    if (type === 'k') {
      score += sign * (opts.endgame ? KING_END[idx] : table[idx]);
    } else {
      score += sign * (table[idx] ?? 0);
    }
    if (type === 'p') pawnFiles[color].push(file);
    file++;
  }

  if (opts.includeStructure) {
    const mateR = material / 100;
    const endgameish = mateR > 8;
    if (!opts.endgame && endgameish) score = evalFen(fen, { ...opts, endgame: true });
    for (const color of ['w', 'b'] as const) {
      const sign = color === 'w' ? 1 : -1;
      const files = pawnFiles[color];
      const seen = new Map<number, number>();
      for (const f of files) seen.set(f, (seen.get(f) ?? 0) + 1);
      for (const [, n] of seen) if (n > 1) score -= sign * 14 * (n - 1); // doubled
      for (let f = 0; f < 8; f++) {
        const has = seen.has(f);
        const adjacent = seen.has(f - 1) || seen.has(f + 1);
        if (has && !adjacent) score += sign * 14; // passed-ish bonus (isolated bonus kept simple)
        if (!has && (f === 0 || f === 7 || !seen.has(f - 1)) && !seen.has(f + 1)) score -= sign * 12; // isolated
      }
      if (counts[color].b === 2) score += sign * 26; // bishop pair
      score += sign * (counts[color].n * 4 + counts[color].r * 6); // minor/activity nudge
    }
  }

  return score;
}

// prettier-ignore
const KING_END = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50,
];

/** Convenience for the UI: centipawn eval of the position from chess.js state. */
export function evalFromFen(fen: string): number {
  return evalFen(fen, { includeStructure: true });
}

/** Win probability 0..1 for a bar UI (sigmoid, saturated around 6 pawns). */
export function scoreToWinProb(cp: number): number {
  return 1 / (1 + Math.exp(-cp / 320));
}
