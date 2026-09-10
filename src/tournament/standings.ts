/** Scoring, tiebreaks and final standings. */
import type { GameEntry, Player, StandingRow } from './types';

export function scoreOf(game: GameEntry, playerId: string): number | null {
  if (!game.result || game.result === '*') return null;
  const value = game.result === '1-0' ? 1 : game.result === '0-1' ? 0 : 0.5;
  if (game.whiteId === playerId) return value;
  if (game.blackId === playerId) return 1 - value;
  return null;
}

export function computeStandings(players: Player[], games: GameEntry[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  const oppRatings = new Map<string, { sum: number; n: number; exp: number }>();
  const results = new Map<string, { opp: string; pts: number }[]>();

  for (const p of players) {
    rows.set(p.id, {
      player: p,
      points: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      sb: 0,
      tpr: p.rating,
      streak: '',
      rank: 0,
    });
    oppRatings.set(p.id, { sum: 0, n: 0, exp: 0 });
    results.set(p.id, []);
  }

  const oppPoints = new Map<string, number>();
  for (const p of players) oppPoints.set(p.id, 0);
  for (const g of games) {
    const w = scoreOf(g, g.whiteId);
    const b = scoreOf(g, g.blackId);
    if (w === null || b === null) continue;
    oppPoints.set(g.whiteId, (oppPoints.get(g.whiteId) ?? 0) + w);
    oppPoints.set(g.blackId, (oppPoints.get(g.blackId) ?? 0) + b);
  }

  for (const g of games) {
    if (g.status === 'bye') {
      const row = rows.get(g.whiteId);
      if (row) {
        row.points += 1;
        row.wins += 1;
        row.played += 1;
        row.streak = `${row.streak}W`.slice(-6);
        oppPoints.set(g.whiteId, (oppPoints.get(g.whiteId) ?? 0) + 1);
      }
    }
  }

  for (const g of games) {
    if (g.status === 'bye') continue;
    const w = scoreOf(g, g.whiteId);
    const b = scoreOf(g, g.blackId);
    if (w === null || b === null) continue;
    const whiteRow = rows.get(g.whiteId);
    const blackRow = rows.get(g.blackId);
    if (!whiteRow || !blackRow) continue;
    whiteRow.points += w;
    blackRow.points += b;
    whiteRow.played++;
    blackRow.played++;
    if (w > b) {
      whiteRow.wins++;
      blackRow.losses++;
    } else if (w < b) {
      blackRow.wins++;
      whiteRow.losses++;
    } else {
      whiteRow.draws++;
      blackRow.draws++;
    }
    const whiteRes = results.get(g.whiteId)!;
    const blackRes = results.get(g.blackId)!;
    whiteRes.push({ opp: g.blackId, pts: w });
    blackRes.push({ opp: g.whiteId, pts: b });
    const wr = players.find((p) => p.id === g.whiteId)?.rating ?? 1500;
    const br = players.find((p) => p.id === g.blackId)?.rating ?? 1500;
    const o1 = oppRatings.get(g.whiteId)!;
    o1.sum += br;
    o1.n++;
    o1.exp += 1 / (1 + 10 ** ((wr - br) / 400));
    const o2 = oppRatings.get(g.blackId)!;
    o2.sum += wr;
    o2.n++;
    o2.exp += 1 / (1 + 10 ** ((br - wr) / 400));
  }

  for (const [id, list] of results) {
    const row = rows.get(id);
    if (!row) continue;
    let sb = 0;
    for (const r of list) sb += r.pts * (oppPoints.get(r.opp) ?? 0);
    row.sb = Math.round(sb * 100) / 100;
    const opp = oppRatings.get(id)!;
    if (opp.n > 0) {
      const avg = opp.sum / opp.n;
      row.tpr = Math.round(avg + ((row.points / Math.max(1, row.played)) - opp.exp / opp.n) * 400);
    }
    row.streak = list
      .slice(-6)
      .map((r) => (r.pts > 0.5 ? 'W' : r.pts === 0.5 ? 'D' : 'L'))
      .join('');
  }

  const sorted = [...rows.values()].sort(
    (a, b) => b.points - a.points || b.sb - a.sb || b.wins - a.wins || b.tpr - a.tpr || a.player.name.localeCompare(b.player.name),
  );
  sorted.forEach((r, i) => (r.rank = i + 1));
  return sorted;
}

/** How many games of a round are still open. */
export function openGames(games: GameEntry[], round: number) {
  return games.filter((g) => g.round === round && g.status !== 'finished' && g.status !== 'bye');
}

export function roundComplete(games: GameEntry[], round: number) {
  return openGames(games, round).length === 0;
}

/** Winners of a knockout round, one per match index. */
export function knockoutWinners(games: GameEntry[], round: number, matchCount: number): (string | null)[] {
  const out: (string | null)[] = [];
  for (let m = 0; m < matchCount; m++) {
    const mgames = games.filter((g) => g.round === round && g.match === m);
    if (mgames.length === 0) {
      out.push(null);
      continue;
    }
    const tally = new Map<string, number>();
    let bye = false;
    for (const g of mgames) {
      if (g.status === 'bye') {
        bye = true;
        continue;
      }
      if (!g.result || g.result === '*') continue;
      const w = scoreOf(g, g.whiteId) ?? 0;
      const b = 1 - w;
      tally.set(g.whiteId, (tally.get(g.whiteId) ?? 0) + w);
      tally.set(g.blackId, (tally.get(g.blackId) ?? 0) + b);
    }
    if (bye) {
      const only = mgames[0].whiteId;
      out.push(only || null);
      continue;
    }
    const finished = mgames.every((g) => g.status === 'finished' || g.status === 'bye');
    if (!finished) {
      out.push(null);
      continue;
    }
    const entries = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    if (entries.length < 2) {
      out.push(entries[0]?.[0] ?? null);
      continue;
    }
    if (entries[0][1] === entries[1][1]) {
      // Deterministic tiebreak: the player who scored with the black pieces goes
      // through, otherwise the higher seed (listed first by the pairer).
      const blackScore = (id: string) =>
        mgames.reduce((acc, g) => acc + (g.blackId === id ? (scoreOf(g, g.blackId) ?? 0) : 0), 0);
      const [a, b] = [entries[0][0], entries[1][0]];
      out.push(blackScore(b) > blackScore(a) ? b : a);
    } else {
      out.push(entries[0][0]);
    }
  }
  return out;
}

export function medalFor(rank: number) {
  return rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
}
