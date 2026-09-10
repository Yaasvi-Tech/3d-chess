/**
 * Static position evaluation shared by two consumers:
 *  - the UI (eval bar, advantage badges) — cheap, synchronous
 *  - the search engine in the web worker (piece-square tables + structure)
 *
 * All scores are centipawns from White's point of view (positive = good for White).
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

/** King activity profile once the queens are off. */
export function evalFen(fen: string, opts: StaticEvalOptions = {}): number {
  const placement = fen.split(' ')[0];
  let rank = 7;
  let file = 0;
  let score = 0;
  /** non-pawn material per side, used to spot the endgame */
  const fighting: Record<Color, number> = { w: 0, b: 0 };
  const counts: Record<Color, Record<string, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };
  const pawns: Record<Color, { file: number; rank: number }[]> = { w: [], b: [] };
  const kingAt: Record<Color, number | null> = { w: null, b: null };

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
    // tables are printed with rank 8 first, so White reads them bottom-up
    const idx = color === 'w' ? (7 - rank) * 8 + file : rank * 8 + file;
    const sign = color === 'w' ? 1 : -1;
    if (type === 'k') {
      kingAt[color] = idx;
      file++;
      continue;
    }
    const value = PIECE_VALUE[type] ?? 100;
    if (type !== 'p') fighting[color] += value;
    counts[color][type]++;
    // material first, then the positional bonus from the piece-square table
    score += sign * (value + (PST[type]?.[idx] ?? 0));
    if (type === 'p') pawns[color].push({ file, rank });
    file++;
  }

  // King safety matters in the middlegame, centralisation in the endgame.
  const endgame =
    opts.endgame ??
    ((counts.w.q === 0 && counts.b.q === 0) || (fighting.w <= 700 && fighting.b <= 700));
  const kingTable = endgame ? KING_END : (PST.k ?? KING_END);
  if (kingAt.w !== null) score += kingTable[kingAt.w] ?? 0;
  if (kingAt.b !== null) score -= kingTable[kingAt.b] ?? 0;

  if (opts.includeStructure) {
    for (const color of ['w', 'b'] as const) {
      const sign = color === 'w' ? 1 : -1;
      const mine = pawns[color];
      const theirs = pawns[color === 'w' ? 'b' : 'w'];
      const byFile = new Map<number, number[]>();
      for (const p of mine) {
        const list = byFile.get(p.file);
        if (list) list.push(p.rank);
        else byFile.set(p.file, [p.rank]);
      }
      for (const p of mine) {
        const onFile = byFile.get(p.file)?.length ?? 0;
        if (onFile > 1) score -= sign * 12 * (onFile - 1); // doubled
        const hasNeighbour = byFile.has(p.file - 1) || byFile.has(p.file + 1);
        if (!hasNeighbour) score -= sign * 14; // isolated
        // passed: no enemy pawn can ever catch it on this or an adjacent file
        const blocked = theirs.some((o) =>
          Math.abs(o.file - p.file) <= 1 && (color === 'w' ? o.rank >= p.rank : o.rank <= p.rank),
        );
        if (!blocked) score += sign * (20 + (color === 'w' ? p.rank - 1 : 6 - p.rank) * 8);
      }
      if (counts[color].b === 2) score += sign * 30; // bishop pair
    }
  }

  return score;
}

/** Convenience for the UI: centipawn eval of the position from chess.js state. */
export function evalFromFen(fen: string): number {
  return evalFen(fen, { includeStructure: true });
}

/** Win probability 0..1 for a bar UI (sigmoid, saturated around 6 pawns). */
export function scoreToWinProb(cp: number): number {
  return 1 / (1 + Math.exp(-cp / 320));
}
