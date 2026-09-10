/**
 * React binding for the imperative GameController (external store pattern).
 * Any component that reads controller fields should call one of these hooks so it
 * re-renders when the game state changes, without putting three.js objects into
 * a React store.
 */
import { useSyncExternalStore } from 'react';
import type { GameController } from '../game/controller';

const noopSubscribe = () => () => {};

export function useGameVersion(game: GameController | null | undefined) {
  return useSyncExternalStore(game ? game.subscribe : noopSubscribe, game ? game.getVersion : () => 0, () => 0);
}

/** Re-render on every controller change and return the controller itself. */
export function useGame(game: GameController | null | undefined): GameController | null {
  useGameVersion(game);
  return game ?? null;
}
