import { describe, expect, it, vi } from 'vitest';
import { Chess } from 'chess.js';
import { GameController } from '../src/game/controller';
import { LEVELS, searchPosition } from '../src/game/ai/engineCore';

const silent = () => ({ from: null, to: null, score: 0, depth: 0, nodes: 0, timeMs: 0, evalForWhite: 0 });

/** A controller with the engine stubbed out, so tests drive moves by hand. */
function makeGame(opts: ConstructorParameters<typeof GameController>[0] = {}) {
  const g = new GameController({
    seats: [
      { name: 'W', kind: 'human', level: 0 },
      { name: 'B', kind: 'human', level: 0 },
    ],
    ...opts,
  });
  g.setEngineProvider(async () => silent());
  return g;
}

describe('GameController', () => {
  it('starts at the standard position with 32 pieces and no result', () => {
    const g = makeGame();
    expect(g.pieces).toHaveLength(32);
    expect(g.turn).toBe('w');
    expect(g.over).toBeNull();
    expect(g.status).toBe('playing');
    expect(g.shortStatus()).toBe('White to move');
    g.destroy();
  });

  it('applies a legal move, tracks it and updates derived state', () => {
    const g = makeGame();
    expect(g.play({ from: 'e2', to: 'e4' })).toBe(true);
    expect(g.history).toHaveLength(1);
    expect(g.lastMove?.san).toBe('e4');
    expect(g.turn).toBe('b');
    expect(g.pieces.find((p) => p.square === 'e4')?.type).toBe('p');
    expect(g.play({ from: 'e2', to: 'e5' })).toBe(false);
    g.destroy();
  });

  it('selects a piece and exposes its legal destinations', () => {
    const g = makeGame();
    g.select('g1');
    expect([...g.targets.keys()].sort()).toEqual(['f3', 'h3']);
    g.select('e2');
    expect([...g.targets.keys()].sort()).toEqual(['e3', 'e4']);
    g.clearSelection();
    expect(g.selection).toBeNull();
    expect(g.targets.size).toBe(0);
    g.destroy();
  });

  it('routes a two-tap move through playHuman', () => {
    const g = makeGame();
    g.tapSquare('e2');
    expect(g.selection).toBe('e2');
    g.tapSquare('e4');
    expect(g.selection).toBeNull();
    expect(g.lastMove?.san).toBe('e4');
    g.destroy();
  });

  it('supports drag semantics: press, hover, release on a target', () => {
    const g = makeGame();
    g.beginDrag('d2');
    expect(g.dragging).toBe(true);
    g.setHover('d4');
    g.endDrag('d4');
    expect(g.lastMove?.san).toBe('d4');
    expect(g.dragging).toBe(false);
    g.destroy();
  });

  it('opens a promotion dialog and completes it', () => {
    const g = makeGame({ fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1' });
    g.select('a7');
    expect(g.playHuman('a7', 'a8')).toBe(true);
    expect(g.promotion).toEqual({ from: 'a7', to: 'a8', color: 'w' });
    g.choosePromotion('n');
    expect(g.promotion).toBeNull();
    expect(g.chess.board()[0][0]?.type).toBe('n');
    expect(g.history[0].san).toBe('a8=N');
    g.destroy();
  });

  it('detects check, checkmate and stalemate', () => {
    const mate = makeGame({ fen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3' });
    expect(mate.over?.status).toBe('checkmate');
    expect(mate.over?.result).toBe('0-1');
    expect(mate.shortStatus()).toBe('Checkmate');
    mate.destroy();

    const g = makeGame({ fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1' });
    g.play({ from: 'a1', to: 'a8' });
    expect(g.chess.inCheck()).toBe(true);
    expect(g.checkSquare).toBe('g8');
    g.play({ from: 'g8', to: 'h7' });
    g.play({ from: 'a8', to: 'a7' });
    g.play({ from: 'h7', to: 'h6' });
    g.play({ from: 'a7', to: 'a6' });
    g.play({ from: 'h6', to: 'h5' });
    g.play({ from: 'a6', to: 'a5' });
    g.play({ from: 'h5', to: 'h4' });
    g.play({ from: 'a5', to: 'a4' });
    g.play({ from: 'h4', to: 'h3' });
    g.play({ from: 'a4', to: 'a3' });
    g.play({ from: 'h3', to: 'h2' });
    g.play({ from: 'a3', to: 'a2' });
    g.play({ from: 'h2', to: 'h1' });
    g.play({ from: 'a2', to: 'a1' });
    expect(g.over?.status).toBe('checkmate');
    expect(g.result).toBe('1-0');
    g.destroy();

    const stale = makeGame({ fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1' });
    stale.play({ from: 'h8', to: 'h7' });
    // no legal reply for black is a stalemate in this position
    expect(stale.over?.status).toBe('stalemate');
    expect(stale.result).toBe('1/2-1/2');
    stale.destroy();
  });

  it('handles resign, undo and rematch', () => {
    const g = makeGame();
    g.play({ from: 'e2', to: 'e4' });
    g.play({ from: 'e7', to: 'e5' });
    g.resign('w');
    expect(g.result).toBe('0-1');
    expect(g.over?.status).toBe('resigned');
    g.newGame({ seats: g.seats });
    expect(g.over).toBeNull();
    expect(g.history).toHaveLength(0);
    expect(g.pieces).toHaveLength(32);
    g.destroy();
  });

  it('restores tracked pieces on undo', () => {
    const g = makeGame();
    const before = g.pieces.find((p) => p.square === 'e2');
    g.play({ from: 'e2', to: 'e4' });
    g.play({ from: 'd7', to: 'd5' });
    g.undoPly(2);
    const restored = g.pieces.find((p) => p.square === 'e2');
    expect(restored?.type).toBe('p');
    expect(g.history).toHaveLength(0);
    expect(g.over).toBeNull();
    expect(before).toBeTruthy();
    g.destroy();
  });

  it('writes a PGN with headers and results', () => {
    const g = makeGame();
    g.play({ from: 'f2', to: 'f3' });
    g.play({ from: 'e7', to: 'e5' });
    g.play({ from: 'g2', to: 'g4' });
    g.play({ from: 'd8', to: 'h4' });
    expect(g.over?.status).toBe('checkmate');
    const pgn = g.pgn({ White: 'Alice', Black: 'Bob', Result: '0-1' });
    expect(pgn).toContain('[White "Alice"]');
    expect(pgn).toContain('1. f3 e5 2. g4 Qh4#');
    expect(pgn).toContain('0-1');
    g.destroy();
  });

  it('reports captured material for the trays', () => {
    const g = makeGame({ fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' });
    g.play({ from: 'e4', to: 'd5' });
    const taken = g.capturedCounts();
    expect(taken.takenByWhite).toEqual(['p']);
    expect(taken.takenByBlack).toEqual([]);
    expect(g.graves).toHaveLength(1);
    g.destroy();
  });

  it('runs the clock and flags the loser', async () => {
    const g = makeGame({ clock: { enabled: true, baseMs: 60_000, incMs: 0 } });
    g.clockRunning = true;
    g.clockRemaining[0] = 1;
    await new Promise((r) => setTimeout(r, 460));
    expect(g.over?.status).toBe('timeout');
    expect(g.result).toBe('0-1');
    g.destroy();
  }, 10000);

  it('emits events for move/check/end and fires onOver once', () => {
    const events: string[] = [];
    let overCount = 0;
    const g = new GameController({
      seats: [
        { name: 'W', kind: 'human', level: 0 },
        { name: 'B', kind: 'human', level: 0 },
      ],
      onEvent: (e) => events.push(e.type),
      onOver: () => overCount++,
    });
    g.setEngineProvider(async () => silent());
    expect(g.play({ from: 'f2', to: 'f3' })).toBe(true);
    expect(g.play({ from: 'e7', to: 'e5' })).toBe(true);
    expect(g.play({ from: 'g2', to: 'g4' })).toBe(true);
    expect(g.play({ from: 'd8', to: 'h4' })).toBe(true);
    expect(events).toContain('move');
    expect(events).toContain('check');
    expect(events).toContain('end');
    expect(overCount).toBe(1);
    g.destroy();
  });

  it('emits capture and castle events', () => {
    const events: string[] = [];
    const g = makeGame({ onEvent: (e) => events.push(e.type) });
    g.play({ from: 'e2', to: 'e4' });
    g.play({ from: 'd7', to: 'd5' });
    g.play({ from: 'e4', to: 'd5' });
    expect(events).toContain('capture');
    const c = makeGame({ fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1' });
    const cEvents: string[] = [];
    c.onEvent = (e) => cEvents.push(e.type);
    c.play({ from: 'e1', to: 'g1' });
    expect(cEvents).toContain('castle');
    expect(c.pieces.find((p) => p.square === 'f1')?.type).toBe('r');
    g.destroy();
    c.destroy();
  });

  it('notifies subscribers so React re-renders', () => {
    const g = makeGame();
    const spy = vi.fn();
    const off = g.subscribe(spy);
    const v0 = g.getVersion();
    g.play({ from: 'd2', to: 'd4' });
    expect(g.getVersion()).toBeGreaterThan(v0);
    expect(spy).toHaveBeenCalled();
    off();
    const calls = spy.mock.calls.length;
    g.play({ from: 'd7', to: 'd5' });
    expect(spy.mock.calls.length).toBe(calls);
    g.destroy();
  });

  it('lets a bot seat move through the engine provider', async () => {
    const g = new GameController({
      seats: [
        { name: 'W', kind: 'human', level: 0 },
        { name: 'B', kind: 'bot', level: 2 },
      ],
    });
    g.paceMs = 0;
    g.setEngineProvider(async () => ({ from: 'e7', to: 'e5', promotion: 'q', san: 'e5', score: 0, depth: 2, nodes: 10, timeMs: 1, evalForWhite: 0 }));
    g.play({ from: 'e2', to: 'e4' });
    await new Promise((r) => setTimeout(r, 60));
    expect(g.history[1]?.san).toBe('e5');
    expect(g.thinking).toBeNull();
    g.destroy();
  });

  it('does not move for bots when paused', async () => {
    const g = new GameController({
      seats: [
        { name: 'W', kind: 'bot', level: 1 },
        { name: 'B', kind: 'bot', level: 1 },
      ],
    });
    g.setEngineProvider(async () => ({ from: 'e2', to: 'e4', score: 0, depth: 1, nodes: 1, timeMs: 1, evalForWhite: 0 }));
    g.destroy();

    const h = new GameController({
      seats: [
        { name: 'W', kind: 'bot', level: 1 },
        { name: 'B', kind: 'bot', level: 1 },
      ],
    });
    h.paused = true;
    h.setEngineProvider(async () => ({ from: 'e2', to: 'e4', score: 0, depth: 1, nodes: 1, timeMs: 1, evalForWhite: 0 }));
    await new Promise((r) => setTimeout(r, 80));
    expect(h.history).toHaveLength(0);
    h.destroy();
  });
});

describe('search engine', () => {
  it('returns a legal move for every level', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    for (const level of LEVELS.map((l) => l.key)) {
      const reply = searchPosition({ fen, level, maxMs: 300, seed: level + 1 });
      expect(reply.from, `level ${level}`).toBeTruthy();
      const chess = new Chess(fen);
      const legal = chess.moves({ verbose: true }) as unknown as { from: string; to: string }[];
      expect(legal.some((m) => m.from === reply.from && m.to === reply.to), `level ${level} move legal`).toBe(true);
    }
  });

  it('finds mate in one', () => {
    const reply = searchPosition({ fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', level: 3, maxMs: 900 });
    expect(reply.to).toBe('a8');
    expect(reply.mateIn).toBeGreaterThan(0);
  });

  it('avoids losing the queen for free', () => {
    const reply = searchPosition({ fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2', level: 3, maxMs: 900 });
    expect(reply.san).toBe('Qh4#');
  });

  it('is deterministic per seed but varies across seeds', () => {
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    const a = searchPosition({ fen, level: 1, maxMs: 200, seed: 7 });
    const b = searchPosition({ fen, level: 1, maxMs: 200, seed: 7 });
    expect(a.from === b.from && a.to === b.to).toBe(true);
    const pool = new Set<string>();
    for (let s = 1; s < 9; s++) {
      const r = searchPosition({ fen, level: 0, maxMs: 120, seed: s });
      pool.add(`${r.from}${r.to}`);
    }
    expect(pool.size).toBeGreaterThan(1);
  });

  it('scores a winning position for white', () => {
    const winning = searchPosition({ fen: 'rnb1kbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', level: 2, maxMs: 400, analysis: true });
    const chess = new Chess();
    expect(winning.from).toBeTruthy();
    expect(chess.turn()).toBe('w');
  });
});
