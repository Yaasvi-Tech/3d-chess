/**
 * Pairing algorithms: Berger tables for round robin, a greedy Swiss pairer with
 * colour preferences and no rematches, and a seeded single-elimination bracket.
 */
import type { GameEntry, Player, TournamentFormat } from './types';
import type { ResultCode } from '../game/types';

export interface Pairing {
  white: string | null;
  black: string | null;
}

let gameSeq = 0;
const gid = () => `g${Date.now().toString(36)}${(gameSeq++).toString(36)}`;

/**
 * Assign colours greedily across the whole event: prefer the side that keeps a
 * player's totals balanced and avoids two identical colours in a row. This is
 * what makes round-robin tables look like real ones (3/2 or 2/3 split).
 */
function assignColours(raw: { a: string; b: string | null; bye?: boolean }[][]) {
  const white = new Map<string, number>();
  const black = new Map<string, number>();
  const last = new Map<string, 'w' | 'b'>();
  const cost = (w: string, b: string) => {
    const dw = Math.abs(((white.get(w) ?? 0) + 1) - (black.get(w) ?? 0));
    const db = Math.abs((white.get(b) ?? 0) + 1 - ((black.get(b) ?? 0) + 1));
    const alt = (last.get(w) === 'w' ? 1 : 0) + (last.get(b) === 'b' ? 1 : 0);
    return dw + db + alt;
  };
  return raw.map((round) =>
    round.map(({ a, b, bye }) => {
      if (bye || !b) return { white: a, black: null };
      const ab = cost(a, b);
      const ba = cost(b, a);
      const [w, bl] = ab <= ba ? [a, b] : [b, a];
      white.set(w, (white.get(w) ?? 0) + 1);
      black.set(bl, (black.get(bl) ?? 0) + 1);
      last.set(w, 'w');
      last.set(bl, 'b');
      return { white: w, black: bl };
    }),
  );
}

/** Classic circle (Berger) rotation; a `null` opponent means a bye. */
export function roundRobin(players: Player[]): Pairing[][] {
  const ids: (string | null)[] = players.map((p) => p.id);
  if (ids.length % 2 === 1) ids.push(null);
  if (ids.length === 0) return [];
  if (ids.length === 2) return [[{ white: ids[0], black: ids[1] }]];
  const n = ids.length;
  const arr = ids.slice();
  const raw: { a: string; b: string | null; bye?: boolean }[][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: { a: string; b: string | null; bye?: boolean }[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (!a || !b) {
        round.push({ a: (a ?? b) as string, b: null, bye: true });
      } else {
        round.push({ a, b });
      }
    }
    raw.push(round);
    // rotate: keep arr[0] fixed, move the last entry into position 1
    arr.splice(1, 0, arr.pop() as string);
  }
  return assignColours(raw);
}

interface SwissState {
  points: Map<string, number>;
  colors: Map<string, ('w' | 'b')[]>;
  played: Map<string, Set<string>>;
}

function colourPref(state: SwissState, id: string): 'w' | 'b' {
  const hist = state.colors.get(id) ?? [];
  const w = hist.filter((c) => c === 'w').length;
  const b = hist.filter((c) => c === 'b').length;
  if (w === b) return hist[hist.length - 1] === 'w' ? 'b' : 'w';
  return b > w ? 'w' : 'b';
}

function flipPref(pref: 'w' | 'b'): 'w' | 'b' {
  return pref === 'w' ? 'b' : 'w';
}

/**
 * Greedy Swiss: sort by points, then walk the list pairing each unpaired player
 * with the highest-ranked legal opponent (no repeat, colour-acceptable).
 */
export function swiss(players: Player[], rounds: number, prior: GameEntry[] = []): Pairing[][] {
  const state: SwissState = { points: new Map(), colors: new Map(), played: new Map() };
  for (const p of players) {
    state.points.set(p.id, 0);
    state.colors.set(p.id, []);
    state.played.set(p.id, new Set());
  }
  for (const g of prior) {
    if (!g.result || g.result === '*') continue;
    const pts = g.result === '1-0' ? [1, 0] : g.result === '0-1' ? [0, 1] : [0.5, 0.5];
    state.points.set(g.whiteId, (state.points.get(g.whiteId) ?? 0) + pts[0]);
    state.points.set(g.blackId, (state.points.get(g.blackId) ?? 0) + pts[1]);
    state.colors.get(g.whiteId)?.push('w');
    state.colors.get(g.blackId)?.push('b');
    state.played.get(g.whiteId)?.add(g.blackId);
    state.played.get(g.blackId)?.add(g.whiteId);
  }

  const allRounds: Pairing[][] = [];
  const byId = new Map(players.map((p) => [p.id, p]));
  const orderOf = (id: string) => byId.get(id)?.rating ?? 1200;

  for (let r = 0; r < rounds; r++) {
    const pool = players
      .slice()
      .sort(
        (a, b) =>
          (state.points.get(b.id) ?? 0) - (state.points.get(a.id) ?? 0) ||
          orderOf(b.id) - orderOf(a.id),
      );
    const used = new Set<string>();
    const pairs: Pairing[] = [];
    for (const p of pool) {
      if (used.has(p.id)) continue;
      let opponent: Player | null = null;
      for (const q of pool) {
        if (q.id === p.id || used.has(q.id)) continue;
        if (state.played.get(p.id)?.has(q.id)) continue;
        const ok = colourPref(state, p.id) !== colourPref(state, q.id);
        if (ok || !opponent) opponent = q;
        if (ok) break;
      }
      if (!opponent) {
        pairs.push({ white: p.id, black: null });
        used.add(p.id);
        continue;
      }
      const prefP = colourPref(state, p.id);
      const prefQ = colourPref(state, opponent.id);
      let white: string;
      let black: string;
      if (prefP !== prefQ) {
        white = prefP === 'w' ? p.id : opponent.id;
        black = white === p.id ? opponent.id : p.id;
      } else {
        white = p.id;
        black = opponent.id;
      }
      pairs.push({ white, black });
      used.add(p.id);
      used.add(opponent.id);
      state.colors.get(white)?.push('w');
      state.colors.get(black)?.push('b');
      state.played.get(white)?.add(black);
      state.played.get(black)?.add(white);
      void flipPref;
    }
    allRounds.push(pairs);
    // simulate scoring so the next round can be sorted (0.5 for byes)
    for (const pair of pairs) {
      if (!pair.black) {
        state.points.set(pair.white!, (state.points.get(pair.white!) ?? 0) + 1);
        continue;
      }
      const pts = [1, 0];
      state.points.set(pair.white as string, (state.points.get(pair.white as string) ?? 0) + pts[0]);
      state.points.set(pair.black as string, (state.points.get(pair.black as string) ?? 0) + pts[1]);
    }
  }
  return allRounds;
}

export function suggestedSwissRounds(n: number) {
  return Math.max(3, Math.min(7, Math.ceil(Math.log2(Math.max(2, n)) * 1.6)));
}

/** Standard seeded bracket order: 1 vs N, 2 vs N-1, then recursively split. */
function bracketOrder(size: number): number[] {
  const rounds = Math.round(Math.log2(size));
  let seeds = [1, 2];
  for (let r = 2; r <= rounds; r++) {
    const sum = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const seed of seeds) {
      next.push(seed);
      next.push(sum - seed);
    }
    seeds = next;
  }
  return seeds;
}

/** Seed → bracket, padding to a power of two so the extras get first-round byes. */
export function knockoutBracket(players: Player[]) {
  const seeded = players.slice().sort((a, b) => b.rating - a.rating).map((p) => p.id);
  const size = 2 ** Math.ceil(Math.log2(Math.max(2, seeded.length)));
  const slots: (string | null)[] = seeded.slice();
  while (slots.length < size) slots.push(null);
  const current = bracketOrder(size).map((seed) => slots[seed - 1] ?? null);
  const rounds = Math.round(Math.log2(size));
  const bracket: { round: number; seeds: [string | null, string | null] }[] = [];
  let inRound = current;
  for (let r = 1; r <= rounds; r++) {
    const matches: [string | null, string | null][] = [];
    for (let i = 0; i < inRound.length; i += 2) matches.push([inRound[i], inRound[i + 1] ?? null]);
    matches.forEach((seeds) => bracket.push({ round: r, seeds }));
    inRound = matches.map((_, i) => `w${r}-${i}`);
  }
  return { bracket, rounds, size };
}

/** Build the game list for the first round of a knockout (2 games per match). */
export function knockoutRoundGames(
  players: Player[],
  round: number,
  matches: [string | null, string | null][],
): GameEntry[] {
  const games: GameEntry[] = [];
  matches.forEach(([a, b], idx) => {
    if (!a || !b) {
      games.push({
        id: gid(),
        round,
        match: idx,
        whiteId: (a ?? b)!,
        blackId: '',
        moves: [],
        startFen: null,
        result: '1/2-1/2',
        status: 'bye',
      });
      return;
    }
    const byId = new Map(players.map((p) => [p.id, p]));
    const higherFirst = (byId.get(a)?.rating ?? 0) >= (byId.get(b)?.rating ?? 0) ? [a, b] : [b, a];
    const [first, second] = higherFirst;
    games.push(game(round, idx, first, second));
    games.push(game(round, idx, second, first));
  });
  return games;
}

function game(round: number, match: number, whiteId: string, blackId: string): GameEntry {
  return {
    id: gid(),
    round,
    match,
    whiteId,
    blackId,
    moves: [],
    startFen: null,
    result: null,
    status: 'scheduled',
    whiteElo: 0,
    blackElo: 0,
  };
}

export function gamesFromPairs(pairs: Pairing[], round: number, format: TournamentFormat = 'round-robin'): GameEntry[] {
  return pairs.map((pair, idx) => {
    if (!pair.black) {
      return {
        id: gid(),
        round,
        match: idx,
        whiteId: pair.white!,
        blackId: '',
        moves: [],
        startFen: null,
        result: '1/2-1/2' as ResultCode,
        status: 'bye' as const,
      };
    }
    return game(round, format === 'knockout' ? idx : 0, pair.white!, pair.black!);
  });
}
