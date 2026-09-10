/**
 * A small alpha-beta engine that runs inside a web worker.
 *
 * Deliberately dependency-light (chess.js + our own static eval) so the opponent
 * works fully offline and can be dropped into any seat of a tournament.
 */
import { Chess } from 'chess.js';
import { PIECE_VALUE, evalFen } from '../eval';
import type { Color, PieceType, Sq } from '../types';

export interface SearchRequest {
  fen: string;
  /** 0 casual → 4 master */
  level: number;
  maxMs?: number;
  /** bias so the same level does not repeat identical games */
  seed?: number;
  /** analysis: also used for hints, returns best move even in "dead" positions */
  analysis?: boolean;
}

export interface SearchReply {
  from: Sq | null;
  to: Sq | null;
  promotion?: PieceType;
  san?: string;
  /** centipawns from the searching side's point of view (positive = better for mover) */
  score: number;
  /** full-move counter until mate, negative when the mover gets mated */
  mateIn?: number;
  depth: number;
  nodes: number;
  timeMs: number;
  /** static eval, always positive = better for White (used by the eval bar) */
  evalForWhite: number;
}

export interface LevelConfig {
  key: number;
  name: string;
  /** short marketing label shown in the UI */
  blurb: string;
  depth: number;
  noise: number;
  ms: number;
  blunder: number;
  elo: number;
}

export const LEVELS: LevelConfig[] = [
  { key: 0, name: 'Casual', blurb: 'Learning the moves. Forgives everything.', depth: 1, noise: 95, ms: 120, blunder: 0.3, elo: 700 },
  { key: 1, name: 'Beginner', blurb: 'Hangs a piece every few moves.', depth: 2, noise: 48, ms: 320, blunder: 0.16, elo: 1050 },
  { key: 2, name: 'Club', blurb: 'Solid tactics, basic plans.', depth: 3, noise: 20, ms: 800, blunder: 0.06, elo: 1450 },
  { key: 3, name: 'Strong', blurb: 'Punishes loose play. Bring a friend.', depth: 4, noise: 7, ms: 1600, blunder: 0.02, elo: 1850 },
  { key: 4, name: 'Master', blurb: 'Deep search, no mercy.', depth: 5, noise: 0, ms: 2800, blunder: 0, elo: 2200 },
];

interface RawMove {
  from: Sq;
  to: Sq;
  piece: PieceType;
  color: Color;
  san: string;
  captured?: PieceType;
  promotion?: PieceType;
  flags: string;
}

interface OrderedMove extends RawMove {
  ord: number;
}

const MATE = 100000;

function movesOf(chess: Chess): OrderedMove[] {
  const raw = chess.moves({ verbose: true }) as unknown as RawMove[];
  return raw.map((m) => ({
    ...m,
    ord:
      (m.captured ? 10 * PIECE_VALUE[m.captured] - PIECE_VALUE[m.piece] : 0) +
      (m.promotion ? 900 : 0) +
      (m.flags.includes('e') ? 80 : 0),
  }));
}

class Aborted extends Error {}

class Clock {
  private readonly end: number;
  private nodesSinceCheck = 0;
  constructor(ms: number) {
    this.end = performance.now() + ms;
  }
  get expired(): boolean {
    if (++this.nodesSinceCheck % 1024 !== 0) return false;
    return performance.now() > this.end;
  }
}

function rng(seed: number) {
  let a = (seed || 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Static eval of the current position from the side-to-move's perspective. */
function evalSide(chess: Chess): number {
  const white = evalFen(chess.fen(), { includeStructure: true });
  return chess.turn() === 'w' ? white : -white;
}

function quiesce(chess: Chess, alpha: number, beta: number, depth: number, clock: Clock): number {
  const standPat = evalSide(chess);
  if (depth <= 0 || standPat >= beta) return Math.max(standPat, alpha);
  if (standPat > alpha) alpha = standPat;
  const tactics = movesOf(chess)
    .filter((m) => m.captured || m.promotion)
    .sort((a, b) => b.ord - a.ord);
  for (const m of tactics) {
    if (clock.expired) throw new Aborted();
    chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    const score = -quiesce(chess, -beta, -alpha, depth - 1, clock);
    chess.undo();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(chess: Chess, depth: number, alpha: number, beta: number, ply: number, clock: Clock): number {
  if (clock.expired) throw new Aborted();
  if (chess.isGameOver()) {
    if (chess.isCheckmate()) return -MATE + ply;
    return 0; // stalemate / material / repetition / fifty
  }
  if (depth <= 0) return quiesce(chess, alpha, beta, 3, clock);

  const moves = movesOf(chess).sort((a, b) => b.ord - a.ord);
  let best = -Infinity;
  let legal = 0;
  for (const m of moves) {
    chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    const score = -negamax(chess, depth - 1, -beta, -alpha, ply + 1, clock);
    chess.undo();
    legal++;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  if (legal === 0) return chess.inCheck() ? -MATE + ply : 0;
  return best;
}

const OPENING_BOOK: Record<string, string[]> = {
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1': ['e4', 'd4', 'Nf3', 'c4', 'g3'],
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1': ['e5', 'c5', 'e6', 'd5', 'Nf6', 'd6'],
  'rnbqkbnr/pppppppp/8/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq d3 0 1': ['d5', 'Nf6', 'g6', 'c5', 'e6'],
};

export function searchPosition(req: SearchRequest): SearchReply {
  const t0 = performance.now();
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, req.level ?? 2))];
  const chess = new Chess(req.fen);
  const maxMs = Math.max(40, req.maxMs ?? cfg.ms);
  const evalForWhite = evalFen(req.fen, { includeStructure: true });
  const legal = movesOf(chess);
  if (legal.length === 0) {
    return { from: null, to: null, score: 0, depth: 0, nodes: 0, timeMs: 0, evalForWhite };
  }

  const book = OPENING_BOOK[chess.fen()];
  if (book) {
    const rand = rng((req.seed ?? 1) * 7919 + legal.length);
    const pool = legal.filter((m) => book.includes(m.san));
    const chosen = pool.length ? pool[Math.floor(rand() * pool.length) % pool.length] : null;
    if (chosen) {
      return {
        from: chosen.from,
        to: chosen.to,
        promotion: chosen.promotion,
        san: chosen.san,
        score: 15,
        depth: 0,
        nodes: 1,
        timeMs: performance.now() - t0,
        evalForWhite,
      };
    }
  }

  const clock = new Clock(maxMs);
  let bestMove: OrderedMove | null = null;
  let bestScore = -Infinity;
  let reachedDepth = 0;
  let nodes = 0;

  try {
    for (let depth = 1; depth <= cfg.depth; depth++) {
      let localBest: OrderedMove | null = null;
      let localScore = -Infinity;
      let alpha = -Infinity;
      const ordered = movesOf(chess).sort((a, b) => {
        const pv = (m: OrderedMove) => (bestMove && m.from === bestMove.from && m.to === bestMove.to ? 1 : 0);
        return pv(b) - pv(a) || b.ord - a.ord;
      });
      for (const m of ordered) {
        nodes++;
        chess.move({ from: m.from, to: m.to, promotion: m.promotion });
        const score = -negamax(chess, depth - 1, -Infinity, -alpha, 1, clock);
        chess.undo();
        if (score > localScore) {
          localScore = score;
          localBest = m;
        }
        if (score > alpha) alpha = score;
      }
      if (localBest) {
        bestMove = localBest;
        bestScore = localScore;
        reachedDepth = depth;
      }
      if (bestScore > MATE - 64) break;
      if (performance.now() - t0 > maxMs * 0.6) break;
    }
  } catch (err) {
    if (!(err instanceof Aborted)) throw err;
  } finally {
    // an aborted search unwinds through nodes that still have a move applied;
    // restore the position before it is used for the noise pass below
    chess.load(req.fen);
  }

  if (!bestMove) bestMove = legal[0];
  bestScore = Number.isFinite(bestScore) ? bestScore : evalSide(chess);

  const rand = rng((req.seed ?? 1) * 104729 + 13);
  let chosen: OrderedMove = bestMove;

  if (cfg.noise > 0) {
    // Prefer a move from a noise-wide band around the best score, so play is varied
    // but never random: candidates must still be within ~noise centipawns.
    const candidates = legal
      .map((m) => {
        chess.move({ from: m.from, to: m.to, promotion: m.promotion });
        const after = -evalSide(chess) + (rand() - 0.5) * cfg.noise;
        chess.undo();
        return { m, after };
      })
      .filter((c) => c.after > bestScore - cfg.noise * 1.5)
      .sort((a, b) => b.after - a.after);
    if (candidates[0]) chosen = candidates[0].m;
  }

  if (cfg.blunder > 0 && rand() < cfg.blunder) {
    const idx = Math.floor(rand() * legal.length);
    if (legal[idx]) chosen = legal[idx];
  }

  const isMate = Math.abs(bestScore) > MATE - 64;
  const mateIn = isMate ? Math.sign(bestScore) * Math.ceil((MATE - Math.abs(bestScore) + 1) / 2) : undefined;

  return {
    from: chosen.from,
    to: chosen.to,
    promotion: chosen.promotion,
    san: chosen.san,
    score: Math.round(bestScore),
    mateIn,
    depth: reachedDepth,
    nodes,
    timeMs: performance.now() - t0,
    evalForWhite,
  };
}
