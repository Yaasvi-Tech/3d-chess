/** Tournament domain types. */
import type { ResultCode } from '../game/types';

export type TournamentFormat = 'round-robin' | 'swiss' | 'knockout';

export interface Player {
  id: string;
  name: string;
  kind: 'human' | 'bot';
  /** bot strength 0..4 (ignored for humans) */
  level: number;
  /** display colour for chips and standings bars */
  tint: string;
  rating: number;
  country: string;
}

export interface GameEntry {
  id: string;
  round: number;
  /** index of the match within the round (only used by knockout) */
  match: number;
  whiteId: string;
  blackId: string;
  /** number of plies played, so a finished game can be re-opened for replay */
  moves: string[];
  /** starting FEN (handicap/free-for-all support; null = normal) */
  startFen: string | null;
  result: ResultCode | null;
  status: 'scheduled' | 'ongoing' | 'finished' | 'bye';
  reason?: string;
  whiteElo?: number;
  blackElo?: number;
  /** performance rating delta, filled when the game finishes */
  durationMs?: number;
}

export interface StandingRow {
  player: Player;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  /** Sonneborn-Berger tiebreak */
  sb: number;
  /** rating performance over the event */
  tpr: number;
  streak: string;
  rank: number;
}

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  players: Player[];
  games: GameEntry[];
  rounds: number;
  currentRound: number;
  timeControl: 'bullet' | 'blitz' | 'rapid' | 'classical' | 'untimed';
  clockEnabled: boolean;
  status: 'setup' | 'running' | 'finished';
  createdAt: number;
  winnerId: string | null;
  /** autoplay pace multiplier used by the runner (1, 2, 4, 8) */
  speed: number;
  autoAdvance: boolean;
  /** knockout bracket: rounds → matches → player slots */
  bracket: { round: number; seeds: [string | null, string | null] }[];
  location: string;
  boardStyle: string;
  pieceStyle: string;
}
