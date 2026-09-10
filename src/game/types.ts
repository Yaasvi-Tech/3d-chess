/**
 * Core chess types. The rules engine is chess.js; everything in this folder is
 * the layer that turns a rules engine into something a 3D renderer and a
 * tournament system can consume (stable piece identities, statuses, results).
 */
import type { Color as JsColor, PieceSymbol, Square } from 'chess.js';

export type Color = JsColor;
export type PieceType = PieceSymbol;
export type Sq = Square;

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const ALL_SQUARES: Sq[] = FILES.flatMap((f) =>
  [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}` as Sq),
);

/** A piece on the board with an id that survives moves (so meshes can animate). */
export interface TrackedPiece {
  id: string;
  type: PieceType;
  color: Color;
  square: Sq;
  /** true for the piece that just moved — used to trigger hop animations. */
  justMoved?: boolean;
}

export interface MoveLike {
  from: Sq;
  to: Sq;
  piece: PieceType;
  color: Color;
  san: string;
  captured?: PieceType;
  promotion?: PieceType;
  flags: string;
}

export type GameStatus =
  | 'playing'
  | 'check'
  | 'checkmate'
  | 'stalemate'
  | 'draw-fifty'
  | 'draw-repetition'
  | 'draw-material'
  | 'resigned'
  | 'abandoned'
  | 'timeout';

export type ResultCode = '1-0' | '0-1' | '1/2-1/2' | '*';

export interface SeatConfig {
  /** who sits here */
  name: string;
  kind: 'human' | 'bot' | 'closed';
  /** 0 = beginner … 4 = master (only used for bots) */
  level: number;
  /** optional avatar tint used by the UI */
  tint?: string;
}

export interface GameOverInfo {
  status: GameStatus;
  result: ResultCode;
  /** short human readable reason, e.g. "Checkmate" */
  reason: string;
}

export const PIECE_NAMES: Record<PieceType, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};

export const PIECE_LETTER: Record<PieceType, string> = {
  p: '',
  n: 'N',
  b: 'B',
  r: 'R',
  q: 'Q',
  k: 'K',
};

/** Unicode glyphs — used by the 2D move list / captured trays. */
export const GLYPH: Record<Color, Record<PieceType, string>> = {
  w: { k: '\u2654', q: '\u2655', r: '\u2656', b: '\u2657', n: '\u2658', p: '\u2659' },
  b: { k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F' },
};
