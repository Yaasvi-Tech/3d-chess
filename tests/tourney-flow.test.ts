/**
 * Integration test for the tournament plumbing: create → start → live boards →
 * results → standings → export. Engines are left paused so the test itself plays
 * the moves; everything else is the real store and the real game controllers.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useTournaments } from '../src/tournament/store';
import { computeStandings } from '../src/tournament/standings';

const players = [
  { id: 'me', name: 'You', kind: 'human' as const, level: 0, rating: 1500, tint: '#fff', country: 'YOU' },
  { id: 'b1', name: 'Bot One', kind: 'bot' as const, level: 0, rating: 1500, tint: '#fff', country: 'BOT' },
  { id: 'b2', name: 'Bot Two', kind: 'bot' as const, level: 0, rating: 1500, tint: '#fff', country: 'BOT' },
];

const reset = () => useTournaments.setState({ tournaments: [], activeId: null, paused: true, runtime: {} });

beforeEach(reset);
afterEach(() => {
  Object.values(useTournaments.getState().runtime).forEach((c) => c.destroy());
  reset();
});

describe('tournament flow', () => {
  it('creates a round robin with the right shape', () => {
    const s = useTournaments.getState();
    const id = s.createTournament({ name: 'Test Open', format: 'round-robin', players, timeControl: 'rapid', clockEnabled: false, autoAdvance: false });
    const t = useTournaments.getState().tournaments.find((x) => x.id === id)!;
    expect(t.players).toHaveLength(3);
    expect(t.rounds).toBe(2);
    expect(t.status).toBe('setup');
    expect(t.games).toHaveLength(0);
  });

  it('starts round 1 with live controllers and records results into the table', async () => {
    const s = useTournaments.getState();
    const id = s.createTournament({ name: 'Test Open', format: 'round-robin', players, timeControl: 'rapid', clockEnabled: false, autoAdvance: false });
    useTournaments.getState().start(id);

    let t = useTournaments.getState().tournaments.find((x) => x.id === id)!;
    expect(t.currentRound).toBe(1);
    expect(t.games.filter((g) => g.round === 1).length).toBe(2); // one pairing + one bye
    const bye = t.games.find((g) => g.status === 'bye');
    expect(bye).toBeTruthy();

    const live = t.games.filter((g) => g.round === 1 && g.status !== 'bye');
    expect(live).toHaveLength(1);
    const game = live[0];
    const ctrl = useTournaments.getState().runtime[game.id];
    expect(ctrl, 'a live controller exists for the board').toBeTruthy();

    // the board really is a chess game
    ctrl.play({ from: 'e2', to: 'e4' });
    ctrl.play({ from: 'e7', to: 'e5' });
    ctrl.play({ from: 'g1', to: 'f3' });
    ctrl.resign('b');
    await new Promise((r) => setTimeout(r, 30));

    t = useTournaments.getState().tournaments.find((x) => x.id === id)!;
    const stored = t.games.find((g) => g.id === game.id)!;
    expect(stored.status).toBe('finished');
    expect(stored.result === '1-0' || stored.result === '0-1').toBe(true);
    expect(stored.moves).toEqual(['e4', 'e5', 'Nf3']);

    const table = computeStandings(t.players, t.games);
    expect(table[0].points).toBe(1);
    expect(table[0].wins).toBe(1);
    expect(table.find((r) => r.player.id === bye!.whiteId)?.points).toBe(1); // bye counts
    expect(t.status).toBe('running');

    // export contains the game
    const pgn = useTournaments.getState().exportPgn(id);
    expect(pgn).toContain('1. e4 e5 2. Nf3');
    expect(pgn).toContain('[Event "Test Open"]');

    // and the next round gets paired from the results
    useTournaments.getState().finishRound(id);
    t = useTournaments.getState().tournaments.find((x) => x.id === id)!;
    expect(t.currentRound).toBe(2);
    expect(t.games.filter((g) => g.round === 2).length).toBe(2);
  });

  it('finishes a swiss and crowns a winner', () => {
    const s = useTournaments.getState();
    const id = s.createTournament({ name: 'Swiss', format: 'swiss', players, rounds: 1, timeControl: 'blitz', clockEnabled: false, autoAdvance: false });
    useTournaments.getState().start(id);
    let t = useTournaments.getState().tournaments.find((x) => x.id === id)!;
    const game = t.games.find((g) => g.round === 1 && g.status !== 'bye')!;
    expect(game).toBeTruthy();
    const ctrl = useTournaments.getState().runtime[game.id];
    ctrl.play({ from: 'f2', to: 'f3' });
    ctrl.play({ from: 'e7', to: 'e5' });
    ctrl.play({ from: 'g2', to: 'g4' });
    ctrl.play({ from: 'd8', to: 'h4' }); // fool's mate
    expect(ctrl.over?.status).toBe('checkmate');

    useTournaments.getState().finishRound(id);
    t = useTournaments.getState().tournaments.find((x) => x.id === id)!;
    expect(t.status).toBe('finished');
    expect(t.winnerId).toBeTruthy();
    const table = computeStandings(t.players, t.games);
    expect(table[0].player.id).toBe(t.winnerId);
  });

  it('openBoard hands the human their seat and releaseBoard gives it back', () => {
    const s = useTournaments.getState();
    const four = [
      ...players,
      { id: 'b3', name: 'Bot Three', kind: 'bot' as const, level: 0, rating: 1500, tint: '#fff', country: 'BOT' },
    ];
    const id = s.createTournament({ name: 'Seats', format: 'round-robin', players: four, timeControl: 'rapid', clockEnabled: false, autoAdvance: false });
    useTournaments.getState().start(id);
    const t = useTournaments.getState().tournaments.find((x) => x.id === id)!;
    const mine = t.games.find((g) => g.round === 1 && (g.whiteId === 'me' || g.blackId === 'me') && g.status !== 'bye')!;
    const ctrl = useTournaments.getState().openBoard(id, mine.id);
    expect(ctrl).toBeTruthy();
    const humanSeatColor = mine.whiteId === 'me' ? 'w' : 'b';
    expect(ctrl!.seatFor(humanSeatColor).kind).toBe('human');
    useTournaments.getState().releaseBoard(mine.id);
    expect(ctrl!.seatFor(humanSeatColor).kind).toBe('bot');
  });
});
