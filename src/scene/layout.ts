/** Shared scene layout constants (single source of truth for board geometry). */
export const TILE = 1;
export const BOARD_SPAN = 8 * TILE; // 8 units across the 64 squares
export const TILE_THICKNESS = 0.12;
/** y of the tile top surface — pieces rest here */
export const BOARD_TOP = TILE_THICKNESS;
export const FRAME_WIDTH = 0.62;
export const FRAME_HEIGHT = 0.16;
export const PLINTH_HEIGHT = 0.26;
export const BOARD_INNER = BOARD_SPAN / 2;
export const BOARD_OUTER = BOARD_INNER + FRAME_WIDTH;

export const PIECE_SCALE = 0.86; // pieces are sized relative to TILE
export const LIFT = 0.42; // how high a selected/dragged piece floats

import { FILES } from '../game/types';
import { tileToWorld } from '../game/board';

export function squareFromUv(uv: { x: number; y: number } | null | undefined): string | null {
  if (!uv) return null;
  const f = Math.floor(uv.x * 8);
  const r = Math.floor(uv.y * 8);
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return `${FILES[Math.min(7, Math.max(0, f))]}${Math.min(8, Math.max(1, r + 1))}`;
}

export function tilePosition(sq: string): [number, number, number] {
  const { x, z } = tileToWorld(sq as never);
  return [x, BOARD_TOP, z];
}

export function tileCenter(sq: string): [number, number, number] {
  const { x, z } = tileToWorld(sq as never);
  return [x, 0, z];
}
