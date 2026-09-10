/**
 * `GameController` is the single source of truth for one game of chess.
 *
 * It owns a chess.js instance plus everything the 3D view and the tournament
 * runner need on top of the rules: stable piece identities, selection state,
 * bot driving, clocks, results, events (for sound) and PGN.
 *
 * It is a plain class with a tiny subscribe/emit surface so many instances can
 * exist at once (a tournament table of boards) without a store per board.
 */
import { Chess, type Move } from 'chess.js';
import { enginePool, type SearchReply } from './ai/client';
import { evalFen } from './eval';
import { applyMoveToPieces, rebuildAfterUndo, trackedFromBoard } from './pieces';
import type { Color, GameOverInfo, GameStatus, PieceType, ResultCode, SeatConfig, Sq, TrackedPiece } from './types';

export interface ClockConfig {
  enabled: boolean;
  baseMs: number;
  incMs: number;
}

export interface GameEvent {
  type: 'move' | 'capture' | 'castle' | 'promote' | 'check' | 'end' | 'select' | 'reset' | 'undo' | 'resign';
  move?: Move;
  sound?: string;
}

export type EngineProvider = (
  req: { fen: string; level: number; maxMs: number; seed: number },
  signal: AbortSignal,
) => Promise<SearchReply | null>;

export interface ControllerOptions {
  id?: string;
  fen?: string;
  seats?: [SeatConfig, SeatConfig];
  clock?: ClockConfig;
  /** delay before a bot reply, roughly the move animation length */
  paceMs?: number;
  /** tournament fast-forward: no animation pacing, no per-move emits */
  turbo?: boolean;
  orientation?: Color;
  onEvent?: (e: GameEvent) => void;
  onOver?: (info: GameOverInfo) => void;
}

let seq = 0;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class GameController {
  readonly id: string;
  chess: Chess;
  pieces: TrackedPiece[] = [];
  /** pieces recently captured, still rendered while they topple away */
  graves: { piece: TrackedPiece; at: number; to: Sq }[] = [];
  history: Move[] = [];
  over: GameOverInfo | null = null;
  status: GameStatus = 'playing';
  selection: Sq | null = null;
  targets: Map<Sq, Move> = new Map();
  hover: Sq | null = null;
  dragging = false;
  promotion: { from: Sq; to: Sq; color: Color } | null = null;
  thinking: Color | null = null;
  hint: { from: Sq; to: Sq } | null = null;
  lastMove: Move | null = null;
  checkSquare: Sq | null = null;
  evalForWhite = 0;
  engineInfo: { depth: number; nodes: number; score: number; ms: number; san?: string } | null = null;
  orientation: Color;
  seats: [SeatConfig, SeatConfig];
  clock: ClockConfig;
  clockRemaining: [number, number] = [0, 0];
  clockRunning = false;
  paceMs: number;
  turbo: boolean;
  result: ResultCode = '*';
  /** tournament autoplay control */
  paused = false;
  destroyed = false;
  /** set by the tournament runner: this controller mirrors an external game */
  linked = false;

  private listeners = new Set<() => void>();
  private version = 0;
  private engineToken = 0;
  private abort?: AbortController;
  private ticker?: ReturnType<typeof setInterval>;
  private provider: EngineProvider;

  constructor(opts: ControllerOptions = {}) {
    this.id = opts.id ?? `game-${++seq}`;
    this.chess = new Chess(opts.fen);
    this.pieces = trackedFromBoard(this.chess);
    this.orientation = opts.orientation ?? 'w';
    this.seats = opts.seats ?? [
      { name: 'You', kind: 'human', level: 2 },
      { name: 'Engine', kind: 'bot', level: 2 },
    ];
    this.clock = opts.clock ?? { enabled: false, baseMs: 600000, incMs: 0 };
    this.clockRemaining = [this.clock.baseMs, this.clock.baseMs];
    this.paceMs = opts.paceMs ?? 340;
    this.turbo = opts.turbo ?? false;
    this.onEvent = opts.onEvent;
    this.onOver = opts.onOver;
    this.provider = defaultProvider;
    this.refreshDerived();
    this.startTicker();
    this.maybeEngine();
  }

  onEvent?: (e: GameEvent) => void;
  onOver?: (info: GameOverInfo) => void;

  // ---------------------------------------------------------------- store glue
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;

  emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  private fire(e: GameEvent) {
    this.onEvent?.(e);
  }

  // ------------------------------------------------------------------ derived
  get turn(): Color {
    return this.chess.turn();
  }

  get isLastRank() {
    return this.chess.isCheckmate() || this.chess.isStalemate() || this.chess.isDraw();
  }

  seatFor(color: Color): SeatConfig {
    return color === 'w' ? this.seats[0] : this.seats[1];
  }

  setSeats(seats: [SeatConfig, SeatConfig]) {
    this.seats = seats;
    this.emit();
    this.maybeEngine();
  }

  setSeat(color: Color, seat: SeatConfig) {
    this.seats = color === 'w' ? [seat, this.seats[1]] : [this.seats[0], seat];
    this.emit();
    this.maybeEngine();
  }

  setTurbo(turbo: boolean) {
    this.turbo = turbo;
    this.paceMs = turbo ? 0 : 340;
  }

  humanCanMove(color: Color = this.turn) {
    return !this.over && !this.promotion && this.seatFor(color).kind === 'human' && this.turn === color;
  }

  // ----------------------------------------------------------------- geometry
  legalMovesFrom(sq: Sq): Move[] {
    if (!this.humanCanMove()) return [];
    return (this.chess.moves({ square: sq, verbose: true }) as unknown as Move[]) ?? [];
  }

  allLegalMoves(): Move[] {
    return this.chess.moves({ verbose: true }) as unknown as Move[];
  }

  pieceAt(sq: Sq) {
    return this.pieces.find((p) => p.square === sq) ?? null;
  }

  // ------------------------------------------------------------------ actions
  /** Board click. Handles select → move → deselect and drag-drop semantics. */
  tapSquare(sq: Sq) {
    if (this.over || this.promotion) return;
    const mover = this.pieceAt(sq);
    const selected = this.selection;

    if (selected) {
      const mv = this.targets.get(sq);
      if (mv) {
        this.playHuman(mv.from, mv.to);
        return;
      }
    }
    if (mover && mover.color === this.turn && this.humanCanMove()) {
      this.select(sq);
      return;
    }
    this.clearSelection();
  }

  select(sq: Sq) {
    const moves = (this.chess.moves({ square: sq, verbose: true }) as unknown as Move[]) ?? [];
    if (!moves.length) {
      this.clearSelection();
      return;
    }
    const piece = this.chess.get(sq as Sq);
    if (!piece || piece.color !== this.turn || !this.humanCanMove()) {
      this.clearSelection();
      return;
    }
    this.selection = sq;
    this.targets = new Map(moves.map((m) => [m.to as Sq, m]));
    this.hint = null;
    this.fire({ type: 'select' });
    this.emit();
  }

  clearSelection() {
    if (this.selection || this.targets.size) {
      this.selection = null;
      this.targets = new Map();
      this.emit();
    }
  }

  setHover(sq: Sq | null) {
    if (this.hover === sq) return;
    this.hover = sq;
    this.emit();
  }

  beginDrag(sq: Sq) {
    if (!this.humanCanMove()) return;
    const piece = this.pieceAt(sq);
    if (!piece || piece.color !== this.turn) return;
    this.select(sq);
    this.dragging = true;
    this.emit();
  }

  endDrag(sq: Sq | null) {
    if (!this.dragging) return;
    this.dragging = false;
    if (sq && this.selection && this.targets.has(sq)) {
      const mv = this.targets.get(sq)!;
      this.playHuman(mv.from, mv.to);
    } else {
      this.emit();
    }
  }

  /** Human plays a move (handles the promotion dialog). */
  playHuman(from: Sq, to: Sq) {
    const mv = this.targets.get(to) ?? this.findLegal(from, to);
    if (!mv) return false;
    if (mv.promotion) {
      this.promotion = { from, to, color: this.turn };
      this.emit();
      return true;
    }
    return this.play({ from, to });
  }

  private findLegal(from: Sq, to: Sq): Move | undefined {
    const moves = (this.chess.moves({ square: from, verbose: true }) as unknown as Move[]) ?? [];
    return moves.find((m) => m.to === to);
  }

  choosePromotion(type: PieceType) {
    if (!this.promotion) return;
    const { from, to } = this.promotion;
    this.promotion = null;
    this.play({ from, to, promotion: type });
  }

  cancelPromotion() {
    this.promotion = null;
    this.clearSelection();
    this.emit();
  }

  /** Core move application. Returns false for illegal moves. */
  play(move: { from: Sq; to: Sq; promotion?: PieceType }): boolean {
    if (this.over) return false;
    let mv: Move;
    try {
      mv = this.chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' });
    } catch {
      return false;
    }
    const diff = applyMoveToPieces(this.pieces, mv as unknown as Parameters<typeof applyMoveToPieces>[1]);
    this.pieces = diff.pieces;
    if (diff.captured) {
      this.graves = [...this.graves, { piece: diff.captured, at: performance.now(), to: mv.to }].slice(-14);
    }
    this.history.push(mv);
    this.lastMove = mv;
    this.selection = null;
    this.targets = new Map();
    this.hover = null;
    this.hint = null;
    this.evalForWhite = evalFen(this.chess.fen(), { includeStructure: true });
    this.refreshDerived();

    if (mv.flags.includes('k') || mv.flags.includes('q')) this.fire({ type: 'castle', move: mv });
    else if (mv.captured) this.fire({ type: 'capture', move: mv });
    else this.fire({ type: 'move', move: mv });
    if (mv.promotion) this.fire({ type: 'promote', move: mv });
    if (this.chess.inCheck()) this.fire({ type: 'check', move: mv });

    // clock bookkeeping
    if (this.clock.enabled) {
      const idx = mv.color === 'w' ? 0 : 1;
      this.clockRemaining[idx] += this.clock.incMs;
      this.clockRemaining[idx === 0 ? 1 : 0] = Math.max(0, this.clockRemaining[idx === 0 ? 1 : 0]);
    }

    if (!this.over) this.emit();
    this.maybeEngine();
    return true;
  }

  private refreshDerived() {
    this.checkSquare = null;
    if (this.chess.inCheck()) {
      const color = this.chess.turn();
      const found = this.pieces.find((p) => p.type === 'k' && p.color === color);
      if (found) this.checkSquare = found.square;
    }
    this.status = this.computeStatus();
    if (this.status !== 'playing' && !this.over) {
      const info = this.describeEnd();
      this.over = info;
      this.result = info.result;
      this.clockRunning = false;
      this.fire({ type: 'end', sound: info.status === 'checkmate' ? 'end-win' : 'end-draw' });
      this.onOver?.(info);
    }
    this.emit();
  }

  private computeStatus(): GameStatus {
    if (this.chess.isCheckmate()) return 'checkmate';
    if (this.chess.isStalemate()) return 'stalemate';
    if (this.chess.isInsufficientMaterial()) return 'draw-material';
    if (this.chess.isThreefoldRepetition()) return 'draw-repetition';
    if (this.chess.isDraw()) return 'draw-fifty';
    if (this.chess.inCheck()) return 'check';
    return 'playing';
  }

  private describeEnd(): GameOverInfo {
    const loser: Color = this.chess.turn();
    const winner: Color = loser === 'w' ? 'b' : 'w';
    const reason =
      this.status === 'checkmate'
        ? 'Checkmate'
        : this.status === 'stalemate'
          ? 'Stalemate — no legal moves'
          : this.status === 'draw-material'
            ? 'Draw — insufficient material'
            : this.status === 'draw-repetition'
              ? 'Draw — threefold repetition'
              : 'Draw — fifty-move rule';
    const result: ResultCode =
      this.status === 'checkmate' ? (winner === 'w' ? '1-0' : '0-1') : '1/2-1/2';
    return { status: this.status, result, reason };
  }

  setOverFrom(info: GameOverInfo) {
    if (this.over) return;
    this.over = info;
    this.result = info.result;
    this.status = info.status;
    this.clockRunning = false;
    this.fire({ type: 'end', sound: info.status === 'timeout' ? 'end-time' : 'end-resign' });
    this.onOver?.(info);
    this.emit();
  }

  resign(color: Color = this.orientation) {
    if (this.over) return;
    this.setOverFrom({
      status: 'resigned',
      result: color === 'w' ? '0-1' : '1-0',
      reason: `${color === 'w' ? 'White' : 'Black'} resigned`,
    });
  }

  agreeDraw() {
    if (this.over) return;
    this.setOverFrom({ status: 'draw-material', result: '1/2-1/2', reason: 'Draw agreed' });
  }

  undoPly(count = 1) {
    if (this.history.length === 0) return;
    this.abort?.abort();
    this.engineToken++;
    this.thinking = null;
    for (let i = 0; i < count && this.history.length; i++) {
      this.chess.undo();
      this.history.pop();
    }
    this.pieces = rebuildAfterUndo(this.chess, this.pieces);
    this.graves = [];
    this.lastMove = (this.history[this.history.length - 1] as Move) ?? null;
    this.over = null;
    this.result = '*';
    this.promotion = null;
    this.refreshDerived();
    this.fire({ type: 'undo' });
    this.maybeEngine();
  }

  /** Fast-forward a finished/ongoing game from a SAN list without engines or sounds. */
  replayMoves(sans: string[]) {
    this.engineToken++;
    this.abort?.abort();
    for (const san of sans) {
      const legal = (this.chess.moves({ verbose: true }) as unknown as Move[]).find((m) => m.san === san);
      if (!legal) break;
      try {
        this.chess.move(san);
      } catch {
        break;
      }
      const diff = applyMoveToPieces(this.pieces, legal as unknown as Parameters<typeof applyMoveToPieces>[1]);
      this.pieces = diff.pieces;
      this.history.push(legal);
      this.lastMove = legal;
    }
    this.graves = [];
    this.evalForWhite = evalFen(this.chess.fen(), { includeStructure: true });
    this.refreshDerived();
    this.emit();
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (!paused) this.maybeEngine();
    this.emit();
  }

  loadFen(fen: string) {
    this.abort?.abort();
    this.engineToken++;
    try {
      this.chess = new Chess(fen);
    } catch {
      return false;
    }
    this.pieces = trackedFromBoard(this.chess);
    this.history = [];
    this.graves = [];
    this.lastMove = null;
    this.over = null;
    this.result = '*';
    this.selection = null;
    this.targets = new Map();
    this.promotion = null;
    this.evalForWhite = evalFen(fen, { includeStructure: true });
    this.status = this.computeStatus();
    this.fire({ type: 'reset' });
    this.refreshDerived();
    this.clockRemaining = [this.clock.baseMs, this.clock.baseMs];
    this.maybeEngine();
    return true;
  }

  newGame(opts: { fen?: string; clock?: ClockConfig; seats?: [SeatConfig, SeatConfig]; orientation?: Color } = {}) {
    this.abort?.abort();
    this.engineToken++;
    this.chess = new Chess(opts.fen);
    if (opts.seats) this.seats = opts.seats;
    if (opts.clock) {
      this.clock = opts.clock;
      this.clockRemaining = [opts.clock.baseMs, opts.clock.baseMs];
      this.clockRunning = opts.clock.enabled;
    }
    if (opts.orientation) this.orientation = opts.orientation;
    this.pieces = trackedFromBoard(this.chess);
    this.history = [];
    this.graves = [];
    this.lastMove = null;
    this.over = null;
    this.result = '*';
    this.selection = null;
    this.targets = new Map();
    this.promotion = null;
    this.thinking = null;
    this.hint = null;
    this.engineInfo = null;
    this.evalForWhite = 0;
    this.status = 'playing';
    this.fire({ type: 'reset' });
    this.emit();
    this.maybeEngine();
  }

  toggleOrientation() {
    this.orientation = this.orientation === 'w' ? 'b' : 'w';
    this.emit();
  }

  setEngineProvider(fn: EngineProvider) {
    this.provider = fn;
  }

  // -------------------------------------------------------------------- clock
  private startTicker() {
    if (this.ticker) clearInterval(this.ticker);
    if (typeof window === 'undefined') return;
    let last = performance.now();
    this.ticker = setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (!this.clock.enabled || !this.clockRunning || this.over) return;
      const idx = this.turn === 'w' ? 0 : 1;
      this.clockRemaining[idx] = Math.max(0, this.clockRemaining[idx] - dt);
      if (this.clockRemaining[idx] <= 0) {
        const loser = this.turn;
        this.clockRunning = false;
        this.setOverFrom({
          status: 'timeout',
          result: loser === 'w' ? '0-1' : '1-0',
          reason: `${loser === 'w' ? 'White' : 'Black'} flagged`,
        });
        return;
      }
      this.emit();
    }, 200);
  }

  setClockRunning(run: boolean) {
    this.clockRunning = run && this.clock.enabled && !this.over;
    this.emit();
  }

  destroy() {
    this.destroyed = true;
    this.paused = true;
    this.engineToken++;
    this.abort?.abort();
    if (this.ticker) clearInterval(this.ticker);
    this.listeners.clear();
  }

  // ------------------------------------------------------------------- engine
  private async maybeEngine() {
    this.engineToken++;
    const token = this.engineToken;
    this.abort?.abort();
    if (this.over || this.promotion || this.paused || this.destroyed) {
      this.thinking = null;
      return;
    }
    const color = this.chess.turn();
    const seat = this.seatFor(color);
    if (seat.kind !== 'bot') {
      this.thinking = null;
      this.emit();
      return;
    }
    if (this.chess.isGameOver()) {
      this.thinking = null;
      return;
    }
    this.thinking = color;
    this.emit();

    const abort = new AbortController();
    this.abort = abort;
    const seed = hashSeed(this.chess.fen()) + seat.level * 31 + this.history.length;
    const maxMs = clamp(180 + seat.level * 520, 120, 2600);
    if (!this.turbo) await sleep(this.paceMs);
    if (token !== this.engineToken) return;

    let reply: SearchReply | null = null;
    try {
      reply = await this.provider({ fen: this.chess.fen(), level: seat.level, maxMs, seed }, abort.signal);
    } catch {
      reply = null;
    }
    if (token !== this.engineToken || this.over) {
      this.thinking = null;
      this.emit();
      return;
    }
    this.thinking = null;
    if (!reply || !reply.from || !reply.to) {
      this.engineInfo = null;
      this.emit();
      return;
    }
    this.engineInfo = {
      depth: reply.depth,
      nodes: reply.nodes,
      score: reply.score,
      ms: Math.round(reply.timeMs),
      san: reply.san,
    };
    if (this.turn !== color) {
      this.emit();
      return;
    }
    this.play({ from: reply.from, to: reply.to, promotion: reply.promotion });
  }

  /** Ask the engine for a suggestion for the side to move (Hint button). */
  async requestHint(level = 3) {
    if (this.over) return null;
    const reply = await enginePool.search(
      { fen: this.chess.fen(), level, maxMs: 1200, seed: hashSeed(this.chess.fen()), analysis: true },
      undefined,
    );
    if (!reply || !reply.from || !reply.to) return null;
    this.hint = { from: reply.from, to: reply.to };
    this.emit();
    setTimeout(() => {
      if (this.hint && this.hint.from === reply.from && this.hint.to === reply.to) {
        this.hint = null;
        this.emit();
      }
    }, 4200);
    return this.hint;
  }

  clearHint() {
    if (this.hint) {
      this.hint = null;
      this.emit();
    }
  }

  // -------------------------------------------------------------------- views
  moveList(): { no: number; white: Move; black?: Move }[] {
    const out: { no: number; white: Move; black?: Move }[] = [];
    for (let i = 0; i < this.history.length; i += 2) {
      out.push({ no: i / 2 + 1, white: this.history[i], black: this.history[i + 1] });
    }
    return out;
  }

  capturedCounts() {
    const start: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
    const left: Record<Color, Record<string, number>> = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    };
    for (const p of this.pieces) if (p.type !== 'k') left[p.color][p.type]++;
    const taken: Record<Color, PieceType[]> = { w: [], b: [] };
    (['w', 'b'] as Color[]).forEach((color) => {
      const order: PieceType[] = ['q', 'r', 'b', 'n', 'p'];
      for (const t of order) {
        const missing = clamp(start[t] - left[color][t], 0, 8);
        for (let i = 0; i < missing; i++) taken[color === 'w' ? 'b' : 'w'].push(t);
      }
    });
    return { takenByWhite: taken.w, takenByBlack: taken.b };
  }

  shortStatus(): string {
    if (this.over) return this.over.reason;
    if (this.chess.inCheck()) return 'Check!';
    if (this.thinking) return `${this.thinking === 'w' ? 'White' : 'Black'} is thinking…`;
    return `${this.turn === 'w' ? 'White' : 'Black'} to move`;
  }

  pgn(headers: Record<string, string> = {}): string {
    const c = new Chess();
    for (const m of this.history) c.move({ from: m.from, to: m.to, promotion: m.promotion });
    for (const [k, v] of Object.entries(headers)) c.setHeader(k, v);
    if (!this.over) c.setHeader('Result', '*');
    else c.setHeader('Result', this.result);
    return c.pgn({ maxWidth: 0 });
  }

  fen() {
    return this.chess.fen();
  }
}

function defaultProvider(
  req: { fen: string; level: number; maxMs: number; seed: number },
  signal: AbortSignal,
) {
  return enginePool.search(req, signal);
}

function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
