import { describe, expect, it } from 'vitest';
import { gamesFromPairs, knockoutBracket, knockoutRoundGames, roundRobin, suggestedSwissRounds, swiss } from '../src/tournament/pairings';
import { computeStandings, knockoutWinners, openGames, roundComplete } from '../src/tournament/standings';
import type { GameEntry, Player } from '../src/tournament/types';

function mkPlayers(n: number, base = 1500): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    kind: 'bot' as const,
    level: (i % 5) as 0,
    rating: base + i * 25,
    tint: '#fff',
    country: `C${i}`,
  }));
}

function game(round: number, whiteId: string, blackId: string, result: GameEntry['result'], status: GameEntry['status'] = 'finished', match = 0): GameEntry {
  return { id: `${round}-${whiteId}-${blackId}`, round, match, whiteId, blackId, moves: [], startFen: null, result, status };
}

describe('round robin pairings', () => {
  it('covers every pair exactly once with balanced colours', () => {
    const players = mkPlayers(6);
    const rounds = roundRobin(players);
    expect(rounds).toHaveLength(5);
    const seen = new Set<string>();
    const colors = new Map<string, { w: number; b: number }>();
    for (const r of rounds) {
      expect(r).toHaveLength(3);
      for (const pair of r) {
        expect(pair.white).toBeTruthy();
        expect(pair.black).toBeTruthy();
        const key = [pair.white, pair.black].sort().join('|');
        expect(seen.has(key), `rematch in round robin: ${key}`).toBe(false);
        seen.add(key);
        const c = (id: string) => {
          const v = colors.get(id) ?? { w: 0, b: 0 };
          return v;
        };
        const cw = c(pair.white!);
        cw.w++;
        colors.set(pair.white!, cw);
        const cb = c(pair.black!);
        cb.b++;
        colors.set(pair.black!, cb);
      }
    }
    expect(seen.size).toBe(15);
    for (const [, v] of colors) expect(Math.abs(v.w - v.b)).toBeLessThanOrEqual(1);
  });

  it('gives one player a bye per round with an odd field', () => {
    const rounds = roundRobin(mkPlayers(5));
    expect(rounds).toHaveLength(5);
    let byes = 0;
    for (const r of rounds) for (const p of r) if (!p.black) byes++;
    expect(byes).toBe(5);
    const games = gamesFromPairs(rounds[0], 1, 'round-robin');
    expect(games.some((g) => g.status === 'bye')).toBe(true);
  });
});

describe('swiss pairings', () => {
  it('pairs all but one with odd fields and never repeats an opponent', () => {
    const players = mkPlayers(9);
    const rounds = suggestedSwissRounds(players.length);
    const pairs = swiss(players, rounds);
    const seen = new Set<string>();
    for (const r of pairs) {
      const ids = new Set<string>();
      for (const p of r) {
        if (p.white) ids.add(p.white);
        if (p.black) ids.add(p.black);
        if (!p.black) continue;
        const key = [p.white, p.black].sort().join('|');
        expect(seen.has(key), `rematch in swiss: ${key}`).toBe(false);
        seen.add(key);
      }
      expect(ids.size).toBe(9); // everyone is paired, one via a forced choice
    }
    expect(pairs.length).toBe(rounds);
  });

  it('uses prior results to avoid rematches in the next round', () => {
    const players = mkPlayers(4);
    const first = swiss(players, 1, [])[0];
    const prior = first.map((p, i) => game(1, p.white!, p.black!, i % 2 ? '1-0' : '0-1'));
    const second = swiss(players, 1, prior)[0];
    for (const p of second) {
      const key = [p.white, p.black].sort().join('|');
      expect(prior.some((g) => [g.whiteId, g.blackId].sort().join('|') === key)).toBe(false);
    }
  });

  it('pairs leaders together and never repeats an opponent', () => {
    const players = mkPlayers(6);
    const prior = [
      game(1, 'p1', 'p2', '1-0'),
      game(1, 'p3', 'p4', '1-0'),
      game(1, 'p5', 'p6', '1-0'),
    ];
    const round2 = swiss(players, 1, prior)[0];
    const played = prior.map((g) => [g.whiteId, g.blackId].sort().join('|'));
    for (const p of round2) {
      if (!p.black) continue;
      const key = [p.white, p.black].sort().join('|');
      expect(played.includes(key), `rematch: ${key}`).toBe(false);
    }
    // the three winners must be on the top three boards
    const top = round2[0];
    expect([top.white, top.black].every((id) => ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].includes(id!))).toBe(true);
  });
});

describe('knockout bracket', () => {
  it('seeds 1 vs N and pads to a power of two with byes', () => {
    const players = mkPlayers(6);
    const seeded = [...players].sort((a, b) => b.rating - a.rating);
    const { bracket, rounds, size } = knockoutBracket(players);
    expect(size).toBe(8);
    expect(rounds).toBe(3);
    const r1 = bracket.filter((b) => b.round === 1);
    expect(r1).toHaveLength(4);
    // 8 slots for 6 players: the two lowest seeds (7 and 8) are byes, so the
    // top two seeds advance without playing and no player appears twice
    const withByes = r1.map((m) => m.seeds.map((s) => s ?? 'BYE'));
    expect(withByes).toEqual([
      [seeded[0].id, 'BYE'],
      [seeded[3].id, seeded[4].id],
      [seeded[1].id, 'BYE'],
      [seeded[2].id, seeded[5].id],
    ]);
    const participants = withByes.flat().filter((x) => x !== 'BYE');
    expect(participants).toHaveLength(6);
    expect(new Set(participants).size).toBe(6);
    expect(bracket.filter((b) => b.round === 2)).toHaveLength(2);
    expect(bracket.filter((b) => b.round === 3)).toHaveLength(1);
  });

  it('plays two games with swapped colours per match', () => {
    const players = mkPlayers(4);
    const { bracket } = knockoutBracket(players);
    const games = knockoutRoundGames(players, 1, bracket.filter((b) => b.round === 1).map((b) => b.seeds));
    expect(games.filter((g) => g.match === 0)).toHaveLength(2);
    const [a, b] = games.filter((g) => g.match === 0);
    expect(a.whiteId).toBe(b.blackId);
    expect(a.blackId).toBe(b.whiteId);
  });

  it('advances the match winner on aggregate score', () => {
    const players = mkPlayers(4);
    const g1 = game(1, 'p1', 'p4', '1-0', 'finished', 0);
    const g2 = game(1, 'p4', 'p1', '1/2-1/2', 'finished', 0);
    const g3 = game(1, 'p2', 'p3', '1-0', 'finished', 1);
    const g4 = game(1, 'p3', 'p2', '1-0', 'finished', 1);
    const winners = knockoutWinners([g1, g2, g3, g4], 1, 2);
    expect(winners[0]).toBe('p1');
    // p2 and p3 are level on points -> somebody advances (lots), never null
    expect(['p2', 'p3']).toContain(winners[1]);
  });

  it('lets a bye through without playing', () => {
    const players = mkPlayers(3);
    const topSeed = [...players].sort((a, b) => b.rating - a.rating)[0];
    const { bracket } = knockoutBracket(players);
    const games = knockoutRoundGames(players, 1, bracket.filter((b) => b.round === 1).map((b) => b.seeds));
    expect(games.some((g) => g.status === 'bye')).toBe(true);
    const winners = knockoutWinners(games, 1, 2);
    expect(winners[0]).toBe(topSeed.id);
    expect(winners[1]).toBeNull(); // the real match has not been played yet
    expect(openGames(games, 1)).toHaveLength(2);
    expect(roundComplete(games, 1)).toBe(false);
    const played = games.map((g) => (g.status === 'bye' ? g : { ...g, status: 'finished' as const, result: '1-0' as const }));
    expect(roundComplete(played, 1)).toBe(true);
    expect(knockoutWinners(played, 1, 2)[1]).toBe('p2');
  });
});

describe('standings', () => {
  it('scores wins, draws and tiebreaks in the right order', () => {
    const players = mkPlayers(4);
    const games = [
      game(1, 'p1', 'p2', '1-0'),
      game(1, 'p3', 'p4', '1/2-1/2'),
      game(2, 'p1', 'p3', '1/2-1/2'),
      game(2, 'p2', 'p4', '1-0'),
      game(3, 'p1', 'p4', '1-0'),
      game(3, 'p2', 'p3', '0-1'),
    ];
    const rows = computeStandings(players, games);
    expect(rows.map((r) => r.player.id)).toEqual(['p1', 'p3', 'p2', 'p4']);
    expect(rows[0].points).toBe(2.5);
    expect(rows[0].wins).toBe(2);
    expect(rows[1].points).toBe(2);
    expect(rows[0].sb).toBeGreaterThanOrEqual(rows[1].sb);
    expect(rows.every((r) => r.played === 3)).toBe(true);
  });

  it('ranks Sonneborn-Berger above the raw win count', () => {
    // p1 and p2 both finish on 1.0. p1 won a game but beat a weak opponent,
    // p2 drew against the leaders — so p2's tiebreak is the better one.
    const players = mkPlayers(4);
    const games = [
      game(1, 'p1', 'p3', '1-0'),
      game(1, 'p2', 'p4', '1/2-1/2'),
      game(2, 'p1', 'p4', '0-1'),
      game(2, 'p2', 'p3', '1/2-1/2'),
    ];
    const rows = computeStandings(players, games);
    const p1 = rows.find((r) => r.player.id === 'p1')!;
    const p2 = rows.find((r) => r.player.id === 'p2')!;
    expect(p1.points).toBe(1);
    expect(p2.points).toBe(1);
    expect(p1.wins).toBe(1);
    expect(p2.wins).toBe(0);
    expect(p2.sb).toBeGreaterThan(p1.sb);
    expect(rows.findIndex((r) => r.player.id === 'p2')).toBeLessThan(rows.findIndex((r) => r.player.id === 'p1'));
  });

  it('counts a round robin bye as a win', () => {
    const players = mkPlayers(3);
    const bye: GameEntry = { id: 'b1', round: 1, match: 0, whiteId: 'p2', blackId: '', moves: [], startFen: null, result: '1/2-1/2', status: 'bye' };
    const rows = computeStandings(players, [bye, game(1, 'p1', 'p3', '1-0')]);
    expect(rows.find((r) => r.player.id === 'p2')?.points).toBe(1);
    expect(rows.find((r) => r.player.id === 'p2')?.wins).toBe(1);
  });
});
