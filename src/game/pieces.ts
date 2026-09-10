/**
 * Stable piece identities.
 *
 * chess.js only knows FENs, so if we re-derived pieces from the board every
 * ply, React/three would remount every mesh and nothing could animate. Instead
 * we keep a list of `TrackedPiece`s whose ids survive moves, captures, castling,
 * en passant and promotions, which lets each mesh slide, hop, or topple.
 */
import type { Chess } from 'chess.js';
import type { MoveLike, TrackedPiece } from './types';

export function trackedFromBoard(chess: Chess): TrackedPiece[] {
  const out: TrackedPiece[] = [];
  const rows = chess.board();
  for (let r = 0; r < rows.length; r++) {
    const rank = 8 - r;
    for (let f = 0; f < 8; f++) {
      const cell = rows[r][f];
      if (!cell) continue;
      const square = `${'abcdefgh'[f]}${rank}` as TrackedPiece['square'];
      out.push({ id: `${cell.color}${cell.type}-${square}`, type: cell.type, color: cell.color, square });
    }
  }
  return out;
}

export interface PieceDiff {
  pieces: TrackedPiece[];
  captured?: TrackedPiece;
  /** extra piece (besides the mover) that slid to a new square: castling rook */
  aux?: { from: string; to: string; piece: TrackedPiece };
}

/** Apply a move to the tracked piece list, keeping identities stable. */
export function applyMoveToPieces(prev: TrackedPiece[], move: MoveLike): PieceDiff {
  const pieces = prev.map((p) => ({ ...p, justMoved: false }));
  let captured: TrackedPiece | undefined;

  const moverIdx = pieces.findIndex((p) => p.square === move.from && p.color === move.color && p.type === move.piece);
  if (moverIdx === -1) {
    // Defensive: rebuild from scratch if the list ever desyncs.
    return { pieces };
  }
  const mover = pieces[moverIdx];

  // en passant takes a pawn that is not on the destination square
  const epSquare =
    move.flags.includes('e') && move.piece === 'p'
      ? (`${move.to[0]}${move.from[1]}` as TrackedPiece['square'])
      : null;
  const captureSquare = epSquare ?? move.to;

  const capIdx = pieces.findIndex((p) => p.square === captureSquare && p.color !== move.color);
  if (capIdx !== -1) {
    captured = pieces[capIdx];
    pieces.splice(capIdx, 1);
  }

  const afterRemoval = pieces.findIndex((p) => p.id === mover.id);
  pieces[afterRemoval] = {
    ...mover,
    square: move.to,
    type: move.promotion ?? mover.type,
    justMoved: true,
  };

  let aux: PieceDiff['aux'];
  if (move.flags.includes('k') && move.piece === 'k') {
    const homeRank = move.color === 'w' ? '1' : '8';
    const rook = pieces.find((p) => p.square === (`h${homeRank}` as TrackedPiece['square']) && p.type === 'r');
    if (rook) {
      const target = (`f${homeRank}` as TrackedPiece['square']) satisfies TrackedPiece['square'];
      aux = { from: rook.square, to: target, piece: { ...rook, square: target } };
      rook.square = target;
      rook.justMoved = true;
    }
  } else if (move.flags.includes('q') && move.piece === 'k') {
    const homeRank = move.color === 'w' ? '1' : '8';
    const rook = pieces.find((p) => p.square === (`a${homeRank}` as TrackedPiece['square']) && p.type === 'r');
    if (rook) {
      const target = (`d${homeRank}` as TrackedPiece['square']) satisfies TrackedPiece['square'];
      aux = { from: rook.square, to: target, piece: { ...rook, square: target } };
      rook.square = target;
      rook.justMoved = true;
    }
  }

  return { pieces, captured, aux };
}

/** Undo: rebuild the list from the restored board (rare action, animation not required). */
export function rebuildAfterUndo(chess: Chess, prev: TrackedPiece[]): TrackedPiece[] {
  const fresh = trackedFromBoard(chess);
  const bySquareType = new Map(prev.map((p) => [`${p.square}|${p.color}`, p.id]));
  return fresh.map((p) => ({ ...p, id: bySquareType.get(`${p.square}|${p.color}`) ?? p.id }));
}

export function piecesBySquare(pieces: TrackedPiece[]): Map<string, TrackedPiece> {
  const m = new Map<string, TrackedPiece>();
  for (const p of pieces) m.set(p.square, p);
  return m;
}

/** Material balance in pawns (used by the eval bar and "advantage" badges). */
const VALUES: Record<string, number> = { p: 1, n: 3, b: 3.2, r: 5, q: 9, k: 0 };

export function materialBalance(pieces: TrackedPiece[]): number {
  let sum = 0;
  for (const p of pieces) if (p.type !== 'k') sum += (p.color === 'w' ? 1 : -1) * (VALUES[p.type] ?? 0);
  return sum;
}

export function capturedLists(pieces: TrackedPiece[]) {
  const start: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const lost: Record<'w' | 'b', Record<string, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };
  const left: Record<'w' | 'b', Record<string, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };
  for (const p of pieces) if (p.type !== 'k') left[p.color][p.type]++;
  for (const color of ['w', 'b'] as const) {
    for (const t of ['p', 'n', 'b', 'r', 'q'] as const) {
      lost[color][t] = Math.max(0, start[t] - left[color][t]);
    }
  }
  return { lostByWhite: lost.w, lostByBlack: lost.b };
}
