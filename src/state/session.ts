/**
 * App session state: which screen is showing, the active game controller and how
 * a match was configured. The controller itself is kept outside of localStorage
 * (it is a live object with workers and timers attached).
 */
import { create } from 'zustand';
import { GameController, type ClockConfig } from '../game/controller';
import type { Color, SeatConfig } from '../game/types';
import { TIME_CONTROLS, type TimeControlId } from '../data/styles';
import { play, primeAudio, type SoundName } from './sound';
import { useSettings } from './settings';

export type Screen = 'home' | 'play' | 'customize' | 'tournaments';

export interface MatchConfig {
  opponent: 'bot' | 'human';
  playerColor: 'w' | 'b' | 'random';
  botLevel: number;
  playerName: string;
  botName: string;
  timeControl: TimeControlId;
  clockEnabled: boolean;
}

export const DEFAULT_MATCH: MatchConfig = {
  opponent: 'bot',
  playerColor: 'w',
  botLevel: 2,
  playerName: 'You',
  botName: 'Engine',
  timeControl: 'rapid',
  clockEnabled: false,
};

export function clockFor(cfg: MatchConfig): ClockConfig {
  const tc = TIME_CONTROLS.find((t) => t.id === cfg.timeControl) ?? TIME_CONTROLS[2];
  return { enabled: cfg.clockEnabled && tc.baseMs > 0, baseMs: tc.baseMs || 600000, incMs: tc.incMs };
}

function seatsFor(cfg: MatchConfig, color: Color): [SeatConfig, SeatConfig] {
  const human: SeatConfig = { name: cfg.playerName || 'You', kind: 'human', level: 0, tint: '#f2f2f2' };
  const bot: SeatConfig = {
    name: cfg.botName || 'Engine',
    kind: 'bot',
    level: cfg.botLevel,
    tint: '#9fb4ff',
  };
  const other: SeatConfig = cfg.opponent === 'human' ? { ...human, name: 'Player 2', tint: '#ffd28a' } : bot;
  return color === 'w' ? [human, other] : [other, human];
}

export function resolveColor(pref: MatchConfig['playerColor']): Color {
  return pref === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : pref;
}

interface SessionState {
  screen: Screen;
  match: MatchConfig;
  game: GameController | null;
  /** set when the active game belongs to a tournament board */
  tournamentBoard: { tournamentId: string; boardId: string; round: number } | null;
  /** read-only board shown while scrubbing the move list */
  preview: GameController | null;
  previewPly: number;
  showCustomize: boolean;
  showPly: (ply: number) => void;
  clearPreview: () => void;
  go: (screen: Screen) => void;
  configure: (patch: Partial<MatchConfig>) => void;
  startMatch: (patch?: Partial<MatchConfig>) => void;
  restart: () => void;
  attach: (game: GameController, board?: SessionState['tournamentBoard']) => void;
  detach: () => void;
}

let unbind: (() => void) | null = null;
let unbindOver: (() => void) | null = null;

function wire(game: GameController) {
  const prevEvents = game.onEvent;
  game.onEvent = (e) => {
    const soundOn = useSettings.getState().sound;
    if (soundOn) {
      const map: Record<string, SoundName> = {
        move: 'move',
        capture: 'capture',
        castle: 'castle',
        check: 'check',
        promote: 'promote',
        select: 'select',
        reset: 'ui',
        undo: 'ui',
      };
      play((e.sound as SoundName) ?? map[e.type] ?? 'ui');
    }
    prevEvents?.(e);
  };
}

export const useSession = create<SessionState>((set, get) => ({
  screen: 'home',
  match: { ...DEFAULT_MATCH },
  game: null,
  tournamentBoard: null,
  preview: null,
  previewPly: 0,
  showCustomize: false,

  showPly: (ply) => {
    const g = get().game;
    if (!g || !g.history.length) return;
    if (ply <= 0 || ply >= g.history.length) {
      get().clearPreview();
      return;
    }
    const mv = g.history[ply - 1];
    let p = get().preview;
    if (!p) {
      p = new GameController({
        id: `preview-${g.id}`,
        fen: mv.after,
        seats: [
          { name: g.seatFor('w').name, kind: 'human', level: 0 },
          { name: g.seatFor('b').name, kind: 'human', level: 0 },
        ],
      });
      set({ preview: p });
    }
    p.paused = true;
    p.orientation = g.orientation;
    p.loadFen(mv.after);
    p.lastMove = mv;
    p.emit();
    set({ previewPly: ply });
  },

  clearPreview: () => {
    if (get().preview) set({ preview: null, previewPly: 0 });
  },

  go: (screen) => {
    primeAudio();
    play('ui');
    set({ screen });
  },

  configure: (patch) => set({ match: { ...get().match, ...patch } }),

  startMatch: (patch) => {
    primeAudio();
    const match = { ...get().match, ...(patch ?? {}) };
    // retire the previous casual game so its clock interval and listeners go away
    const prev = get().game;
    if (prev && !get().tournamentBoard) prev.destroy();
    const color = resolveColor(match.playerColor);
    const game = new GameController({
      id: `play-${Date.now()}`,
      seats: seatsFor(match, color),
      clock: clockFor(match),
      orientation: color,
      paceMs: 320,
    });
    game.clockRunning = match.clockEnabled;
    unbindOver?.();
    set({ game, match, screen: 'play', tournamentBoard: null, preview: null, previewPly: 0 });
    wire(game);
    game.emit();
  },

  restart: () => {
    const { game, match } = get();
    if (!game) return get().startMatch();
    const color = resolveColor(match.playerColor);
    game.newGame({ seats: seatsFor(match, color), clock: clockFor(match), orientation: color });
    game.emit();
  },

  attach: (game, board) => {
    unbindOver?.();
    unbindOver = null;
    unbind?.();
    unbind = null;
    set({ game, tournamentBoard: board ?? null, screen: 'play', preview: null, previewPly: 0 });
    wire(game);
    game.emit();
  },

  detach: () => {
    unbind?.();
    unbind = null;
    set({ game: null, tournamentBoard: null, preview: null, previewPly: 0 });
  },
}));

/** Undo that also works when a bot has the move (rewinds one full move pair). */
export function undoBothSides() {
  const g = useSession.getState().game;
  if (!g) return;
  const color = g.turn;
  const seatIsBot = g.seatFor(color).kind === 'bot';
  g.undoPly(seatIsBot ? 2 : 1);
}

// ---------------------------------------------------------------- attract mode
const DEMO_POSITIONS = [
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  'rnbqkb1r/pp1ppppp/2p2n2/8/3NP3/2N1B3/PPP2PPP/R2QKB1R w KQkq - 0 9',
  'r1bqkbnr/pp2pppp/2np4/8/3NP3/2N1B3/PPP2PPP/R2QKB1R w KQkq - 0 9',
  'rnbqkb1r/ppp2ppp/4pn2/3p4/3PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 0 6',
  'r2q1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 6 9',
];

let demo: GameController | null = null;
let demoIndex = 0;

/** Self-playing demo board used behind the menu. */
export function getDemoGame(): GameController {
  if (demo) return demo;
  const fen = DEMO_POSITIONS[demoIndex++ % DEMO_POSITIONS.length];
  demo = new GameController({
    id: 'demo',
    fen,
    seats: [
      { name: 'Grandmaster AI', kind: 'bot', level: 2, tint: '#e8e2d2' },
      { name: 'Challenger AI', kind: 'bot', level: 2, tint: '#9fb4ff' },
    ],
    paceMs: 950,
    onOver: () => {
      window.setTimeout(() => {
        const next = DEMO_POSITIONS[demoIndex++ % DEMO_POSITIONS.length];
        demo?.newGame({ fen: next });
      }, 6000);
    },
  });
  return demo;
}
