/**
 * Tournament store + live runner.
 *
 * Persisted part: config, players, pairings and results.
 * Live part (`runtime`): one `GameController` per board, self-driving when both
 * seats are bots. Opening a board hands you a seat; closing it hands the seat
 * back to the engine so the round keeps moving.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GameController } from '../game/controller';
import type { GameOverInfo, ResultCode, SeatConfig } from '../game/types';
import { TIME_CONTROLS, type TimeControlId } from '../data/styles';
import { useSettings } from '../state/settings';
import {
  gamesFromPairs,
  knockoutBracket,
  knockoutRoundGames,
  roundRobin,
  suggestedSwissRounds,
  swiss,
  type Pairing,
} from './pairings';
import { computeStandings, knockoutWinners, roundComplete } from './standings';
import type { GameEntry, Player, Tournament, TournamentFormat } from './types';

export interface BotPersona {
  key: string;
  name: string;
  country: string;
  level: number;
  rating: number;
  tint: string;
  style: string;
}

export const BOT_POOL: BotPersona[] = [
  { key: 'rookwood', name: 'Rookwood', country: 'NOR', level: 2, rating: 1620, tint: '#8fb8ff', style: 'Solid, loves endgames' },
  { key: 'maria-t', name: 'Maria Tal', country: 'LAT', level: 3, rating: 1980, tint: '#ff8a6a', style: 'Sacrifices first, thinks later' },
  { key: 'petros-c', name: "Petrosian's Cat", country: 'ARM', level: 3, rating: 1940, tint: '#c9a86a', style: 'Nobody ever breaks through' },
  { key: 'dame-j', name: 'Dame Jeopardy', country: 'FRA', level: 1, rating: 1180, tint: '#7ce7b0', style: 'Blunders with confidence' },
  { key: 'knight-mare', name: 'Knight Mare', country: 'NZL', level: 2, rating: 1560, tint: '#c58cff', style: 'Only plays knights' },
  { key: 'en-p', name: 'M. Passant', country: 'UZB', level: 4, rating: 2180, tint: '#ffd166', style: 'Turns pawns into queens' },
  { key: 'bishop-b', name: 'Bishop Bing', country: 'CHN', level: 1, rating: 1240, tint: '#6fd7ff', style: 'Fianchetto everything' },
  { key: 'morphy-jr', name: 'Morphy Jr.', country: 'USA', level: 3, rating: 1890, tint: '#ff6b9d', style: 'Open files, rapid development' },
  { key: 'zugzwang', name: 'Zugzwang', country: 'GER', level: 4, rating: 2100, tint: '#b6c2d6', style: 'Makes you move, then punishes it' },
  { key: 'pawnster', name: 'The Pawnster', country: 'POL', level: 0, rating: 860, tint: '#a8e6a1', style: 'Just learning, be kind' },
  { key: 'silicia', name: 'Sicilian Def.', country: 'ITA', level: 3, rating: 1850, tint: '#ff9f6e', style: 'Counter-attack, always' },
  { key: 'granite', name: 'Granite', country: 'ISL', level: 2, rating: 1520, tint: '#9fb4c9', style: 'Trades down to a draw' },
];

export const botSeat = (p: Player): SeatConfig => ({ name: p.name, kind: 'bot', level: p.level, tint: p.tint });
export const humanSeat = (p: Player): SeatConfig => ({ name: p.name, kind: 'human', level: 0, tint: p.tint });

export function defaultPlayers(humanName: string): Player[] {
  const keys = ['maria-t', 'rookwood', 'en-p', 'knight-mare', 'zugzwang', 'bishop-b', 'petros-c', 'silicia'];
  const players: Player[] = [
    { id: 'me', name: humanName || 'You', kind: 'human', level: 0, rating: 1500, tint: '#f2f2f2', country: 'YOU' },
    ...keys.map((k, i) => {
      const b = BOT_POOL.find((x) => x.key === k)!;
      return {
        id: `p${i + 1}`,
        name: b.name,
        kind: 'bot' as const,
        level: b.level,
        rating: b.rating,
        tint: b.tint,
        country: b.country,
      };
    }),
  ];
  return players;
}

export interface CreateTournamentInput {
  name: string;
  format: TournamentFormat;
  players: Player[];
  rounds?: number;
  timeControl: TimeControlId;
  clockEnabled: boolean;
  autoAdvance?: boolean;
  speed?: number;
  location?: string;
  boardStyle?: string;
  pieceStyle?: string;
}

interface TournamentState {
  tournaments: Tournament[];
  activeId: string | null;
  paused: boolean;
  /** live games: gameId → controller (never persisted) */
  runtime: Record<string, GameController>;
  createTournament: (input: CreateTournamentInput) => string;
  deleteTournament: (id: string) => void;
  setActive: (id: string | null) => void;
  start: (id: string) => void;
  beginRound: (id: string, round: number) => void;
  finishRound: (id: string) => void;
  reportResult: (id: string, gameId: string, result: ResultCode, moves: string[], reason: string) => void;
  setSpeed: (id: string, speed: number) => void;
  setPaused: (paused: boolean) => void;
  claim: (id: string, gameId: string, playerId: string, asHuman: boolean) => void;
  openBoard: (id: string, gameId: string) => GameController | null;
  releaseBoard: (gameId: string) => void;
  fastForward: (id: string) => void;
  abandon: (id: string) => void;
  exportPgn: (id: string) => string;
  standings: (id: string) => ReturnType<typeof computeStandings>;
}

function update(t: Tournament, patch: Partial<Tournament>): Tournament {
  return { ...t, ...patch };
}

/** Runtime only: create/reuse the controller that drives a tournament board. */
function ensureController(state: TournamentState, t: Tournament, game: GameEntry): GameController {
  const existing = state.runtime[game.id];
  if (existing) return existing;
  const byId = new Map(t.players.map((p) => [p.id, p]));
  const white = byId.get(game.whiteId);
  const black = byId.get(game.blackId);
  const tc = TIME_CONTROLS.find((x) => x.id === t.timeControl) ?? TIME_CONTROLS[2];
  const clock = { enabled: t.clockEnabled && tc.baseMs > 0, baseMs: tc.baseMs || 600000, incMs: tc.incMs };
  const humanSeatOf = (p: Player | undefined): SeatConfig =>
    p && p.kind === 'human' ? { name: p.name, kind: 'human', level: 0, tint: p.tint } : p ? botSeat(p) : { name: '—', kind: 'bot', level: 1 };

  const ctrl = new GameController({
    id: game.id,
    fen: game.startFen ?? undefined,
    seats: [humanSeatOf(white), humanSeatOf(black)],
    clock,
    paceMs: Math.round(520 / Math.max(1, t.speed)),
    turbo: t.speed >= 4,
  });
  if (game.moves.length) ctrl.replayMoves(game.moves);
  ctrl.clockRunning = clock.enabled;
  ctrl.paused = state.paused;
  ctrl.onOver = (info: GameOverInfo) => {
    state.reportResult(t.id, game.id, info.result, ctrl.history.map((m) => m.san), info.reason);
  };
  ctrl.onEvent = () => {
    // keep the schedule entry live so results survive a reload mid-round
    game.status = 'ongoing';
  };
  state.runtime = { ...state.runtime, [game.id]: ctrl };
  return ctrl;
}

export const useTournaments = create<TournamentState>()(
  persist(
    (set, get) => ({
      tournaments: [],
      activeId: null,
      paused: false,
      runtime: {},

      createTournament: (input) => {
        const id = `t${Date.now().toString(36)}`;
        const players = input.players.length >= 2 ? input.players : defaultPlayers('You');
        const format = input.format;
        const rounds =
          input.rounds ??
          (format === 'round-robin' ? players.length - 1 : format === 'swiss' ? suggestedSwissRounds(players.length) : Math.ceil(Math.log2(Math.max(2, players.length))));
        const bracket = format === 'knockout' ? knockoutBracket(players).bracket : [];
        const t: Tournament = {
          id,
          name: input.name || `${format === 'knockout' ? 'Knockout' : format === 'swiss' ? 'Swiss' : 'Round Robin'} Open`,
          format,
          players,
          games: [],
          rounds,
          currentRound: 0,
          timeControl: input.timeControl,
          clockEnabled: input.clockEnabled,
          status: 'setup',
          createdAt: Date.now(),
          winnerId: null,
          speed: input.speed ?? 2,
          autoAdvance: input.autoAdvance ?? true,
          bracket,
          location: input.location ?? 'current',
          boardStyle: input.boardStyle ?? 'current',
          pieceStyle: input.pieceStyle ?? 'current',
        };
        set((s) => ({ tournaments: [t, ...s.tournaments], activeId: id }));
        return id;
      },

      deleteTournament: (id) => {
        const s = get();
        Object.entries(s.runtime).forEach(([gid, c]) => {
          if (gid.startsWith(id)) c.destroy();
        });
        set((st) => ({
          tournaments: st.tournaments.filter((t) => t.id !== id),
          activeId: st.activeId === id ? null : st.activeId,
        }));
      },

      setActive: (id) => set({ activeId: id }),

      start: (id) => {
        const s = get();
        const t = s.tournaments.find((x) => x.id === id);
        if (!t) return;
        applyVenue(t);
        set((st) => ({ tournaments: st.tournaments.map((x) => (x.id === id ? update(x, { status: 'running', currentRound: 1, games: [] }) : x)) }));
        get().beginRound(id, 1);
      },

      beginRound: (id, round) => {
        const s = get();
        const t = s.tournaments.find((x) => x.id === id);
        if (!t || round > t.rounds) return;
        const finished = t.games.filter((g) => g.round < round);
        let pairs: Pairing[][] = [];
        let games: GameEntry[] = [];
        if (t.format === 'round-robin') {
          const all = roundRobin(t.players);
          pairs = [all[Math.min(round - 1, all.length - 1)] ?? []];
          games = gamesFromPairs(pairs[0], round, 'round-robin');
        } else if (t.format === 'swiss') {
          pairs = swiss(t.players, 1, finished);
          games = gamesFromPairs(pairs[0], round, 'swiss');
        } else {
          const seeds = t.bracket.filter((b) => b.round === round).map((b) => b.seeds);
          games = knockoutRoundGames(t.players, round, seeds);
        }

        if (!games.length) {
          // nothing left to pair (bracket exhausted) — close the event out
          set((st) => ({ tournaments: st.tournaments.map((x) => (x.id === id ? update(x, { status: 'running' }) : x)) }));
          get().finishRound(id);
          return;
        }

        const next = update(t, {
          currentRound: round,
          status: 'running',
          games: [...t.games.filter((g) => g.round !== round || g.status === 'finished'), ...games],
        });
        set((st) => ({ tournaments: st.tournaments.map((x) => (x.id === id ? next : x)) }));

        // spawn live boards
        const fresh = get().tournaments.find((x) => x.id === id)!;
        fresh.games
          .filter((g) => g.round === round && g.status === 'scheduled')
          .forEach((g) => {
            if (g.status === 'bye') return;
            ensureController(get(), fresh, g);
          });
        set((st) => ({ tournaments: [...st.tournaments] }));
      },

      finishRound: (id) => {
        const s = get();
        const t = s.tournaments.find((x) => x.id === id);
        if (!t) return;
        if (t.currentRound >= t.rounds) {
          const table = computeStandings(t.players, t.games);
          const winner = t.format === 'knockout' ? knockoutWinners(t.games, t.currentRound, Math.max(1, Math.ceil(t.players.length / 2 ** t.currentRound)))[0] : table[0]?.player.id ?? null;
          set((st) => ({
            tournaments: st.tournaments.map((x) =>
              x.id === id ? update(x, { status: 'finished', winnerId: winner ?? x.players[0]?.id ?? null }) : x,
            ),
          }));
          Object.entries(s.runtime).forEach(([gid, c]) => {
            if (t.games.some((g) => g.id === gid)) c.destroy();
          });
          set((st) => {
            const runtime = { ...st.runtime };
            t.games.forEach((g) => delete runtime[g.id]);
            return { runtime };
          });
          return;
        }
        if (t.format === 'knockout') {
          // advance winners into the next round's bracket
          const matchCount = Math.max(1, t.bracket.filter((b) => b.round === t.currentRound).length);
          const winners = knockoutWinners(t.games, t.currentRound, matchCount);
          const bracket = t.bracket.map((b) => ({ ...b, seeds: [...b.seeds] as [string | null, string | null] }));
          const nextRound = t.currentRound + 1;
          const nextSlots: [string | null, string | null][] = [];
          for (let i = 0; i < winners.length; i += 2) nextSlots.push([winners[i] ?? null, winners[i + 1] ?? null]);
          const filtered = bracket.filter((b) => b.round !== nextRound);
          nextSlots.forEach((seeds) => filtered.push({ round: nextRound, seeds }));
          set((st) => ({
            tournaments: st.tournaments.map((x) => (x.id === id ? update(x, { bracket: filtered, currentRound: nextRound }) : x)),
          }));
        }
        get().beginRound(id, t.currentRound + 1);
      },

      reportResult: (id, gameId, result, moves, reason) => {
        const s = get();
        const t = s.tournaments.find((x) => x.id === id);
        if (!t) return;
        const games = t.games.map((g) =>
          g.id === gameId ? { ...g, result, moves, status: 'finished' as const, reason } : g,
        );
        const roundDone = roundComplete(games, t.currentRound);
        set((st) => ({
          tournaments: st.tournaments.map((x) => (x.id === id ? update(x, { games }) : x)),
        }));
        const ctrl = s.runtime[gameId];
        if (ctrl) {
          ctrl.onEvent = undefined;
        }
        if (roundDone) {
          window.setTimeout(() => {
            const cur = get();
            const live = cur.tournaments.find((x) => x.id === id);
            if (!live || live.status !== 'running') return;
            if (!roundComplete(live.games, live.currentRound)) return;
            if (live.autoAdvance) cur.finishRound(id);
          }, 1400);
        }
      },

      setSpeed: (id, speed) => {
        const s = get();
        const t = s.tournaments.find((x) => x.id === id);
        if (!t) return;
        set((st) => ({ tournaments: st.tournaments.map((x) => (x.id === id ? update(x, { speed }) : x)) }));
        t.games.forEach((g) => {
          const c = s.runtime[g.id];
          if (!c) return;
          c.turbo = speed >= 4;
          c.paceMs = Math.round(520 / speed);
        });
      },

      setPaused: (paused) => {
        const s = get();
        Object.values(s.runtime).forEach((c) => c.setPaused(paused));
        set({ paused });
      },

      /** Give a seat to the local human (or hand it back to the engine). */
      claim: (id, gameId, playerId, asHuman) => {
        const s = get();
        const t = s.tournaments.find((x) => x.id === id);
        const g = t?.games.find((x) => x.id === gameId);
        const ctrl = s.runtime[gameId];
        if (!t || !g || !ctrl) return;
        const player = t.players.find((p) => p.id === playerId);
        if (!player) return;
        const isWhite = g.whiteId === playerId;
        const other = t.players.find((p) => p.id === (isWhite ? g.blackId : g.whiteId));
        const seats: [SeatConfig, SeatConfig] = isWhite
          ? [asHuman ? { ...humanSeat(player) } : botSeat(player), other ? botSeat(other) : { name: '—', kind: 'bot', level: 1 }]
          : [other ? botSeat(other) : { name: '—', kind: 'bot', level: 1 }, asHuman ? { ...humanSeat(player) } : botSeat(player)];
        ctrl.setSeats(seats);
        ctrl.setPaused(false);
        set((st) => ({
          tournaments: st.tournaments.map((x) =>
            x.id === id ? update(x, { players: x.players.map((p) => (p.id === playerId ? { ...p, kind: asHuman ? 'human' : 'bot' } : p)) }) : x,
          ),
        }));
      },

      abandon: (id) => {
        const s = get();
        const t = s.tournaments.find((x) => x.id === id);
        if (!t) return;
        Object.entries(s.runtime).forEach(([gid, c]) => {
          if (t.games.some((g) => g.id === gid)) c.destroy();
        });
        set((st) => {
          const runtime = { ...st.runtime };
          t.games.forEach((g) => delete runtime[g.id]);
          return {
            runtime,
            tournaments: st.tournaments.map((x) => (x.id === id ? update(x, { status: 'setup', currentRound: 0, games: [], winnerId: null }) : x)),
          };
        });
      },

      /** Open a board in the main viewer: hands the human their seat if they play. */
      openBoard: (id, gameId) => {
        const s = get();
        const t = s.tournaments.find((x) => x.id === id);
        const g = t?.games.find((x) => x.id === gameId);
        if (!t || !g) return null;
        const ctrl = ensureController(s, t, g);
        const me = t.players.find((p) => p.kind === 'human');
        const imPlaying = me && (g.whiteId === me.id || g.blackId === me.id);
        if (me) {
          const isWhite = g.whiteId === me.id;
          const other = t.players.find((p) => p.id === (isWhite ? g.blackId : g.whiteId));
          ctrl.setSeats(
            isWhite
              ? [imPlaying ? humanSeat(me) : botSeat(me), other ? botSeat(other) : { name: '—', kind: 'bot', level: 1 }]
              : [other ? botSeat(other) : { name: '—', kind: 'bot', level: 1 }, imPlaying ? humanSeat(me) : botSeat(me)],
          );
        }
        ctrl.setPaused(get().paused);
        return ctrl;
      },

      /** Release the board back to the engines. */
      releaseBoard: (gameId) => {
        const ctrl = get().runtime[gameId];
        if (!ctrl || ctrl.over) return;
        const s = get();
        const t = s.tournaments.find((x) => x.games.some((g) => g.id === gameId));
        if (!t) return;
        const g = t.games.find((x) => x.id === gameId)!;
        const seats: [SeatConfig, SeatConfig] = [botSeat(t.players.find((p) => p.id === g.whiteId) ?? t.players[0]), botSeat(t.players.find((p) => p.id === g.blackId) ?? t.players[1])];
        ctrl.setSeats(seats);
      },

      /** Resolve every unfinished board of the current round as fast as possible. */
      fastForward: (id) => {
        const s = get();
        const t = s.tournaments.find((x) => x.id === id);
        if (!t) return;
        t.games
          .filter((g) => g.round === t.currentRound && g.status !== 'finished')
          .forEach((g) => {
            const c = s.runtime[g.id];
            if (!c) return;
            c.setTurbo(true);
            c.paceMs = 0;
          });
      },

      exportPgn: (id) => {
        const s = get();
        const t = s.tournaments.find((x) => x.id === id);
        if (!t) return '';
        const byId = new Map(t.players.map((p) => [p.id, p]));
        return t.games
          .map((g, i) => {
            const white = byId.get(g.whiteId)?.name ?? '?';
            const black = byId.get(g.blackId)?.name ?? '?';
            let body = '';
            g.moves.forEach((san, idx) => {
              body += idx % 2 === 0 ? `${idx === 0 ? '' : ' '}${idx / 2 + 1}. ${san}` : ` ${san}`;
            });
            return `[Event "${t.name}"]\n[Round "${g.round}"]\n[White "${white}"]\n[Black "${black}"]\n[Result "${g.result ?? '*'}"]\n\n${body} ${g.result ?? '*'}\n`;
          })
          .join('\n');
      },

      standings: (id) => {
        const t = get().tournaments.find((x) => x.id === id);
        if (!t) return [];
        return computeStandings(t.players, t.games);
      },
    }),
    {
      name: 'chess3d.tournaments.v1',
      partialize: (s) => ({ tournaments: s.tournaments, activeId: s.activeId }) as Partial<TournamentState>,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.runtime = {};
        state.paused = false;
      },
    },
  ),
);

/**
 * Push a tournament's configured look onto the global stage settings, so every
 * board in the event is played in the venue the organiser picked.
 */
export function applyVenue(t: Tournament) {
  const settings = useSettings.getState();
  if (t.location && t.location !== 'current') settings.set('location', t.location as never);
  if (t.boardStyle && t.boardStyle !== 'current') settings.set('board', t.boardStyle as never);
  if (t.pieceStyle && t.pieceStyle !== 'current') settings.set('pieces', t.pieceStyle as never);
}

export function getController(gameId: string) {
  return useTournaments.getState().runtime[gameId] ?? null;
}

export function tournamentRoundGames(t: Tournament | undefined, round: number) {
  if (!t) return [];
  return t.games.filter((g) => g.round === round);
}

export function activeTournament(s: TournamentState) {
  return s.tournaments.find((t) => t.id === s.activeId) ?? null;
}
