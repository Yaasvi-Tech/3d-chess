/**
 * Board coordinate helpers. Board space is a 8x8 grid centred on the origin:
 * x = file (a→h), z = rank (1→8), so white starts at +z and looks toward -z.
 */
import { FILES, type Sq } from './types';

export const BOARD_SIZE = 8;
export const TILE = 1; // world units per square
export const HALF = (BOARD_SIZE * TILE) / 2;

export function fileIndex(sq: Sq): number {
  return FILES.indexOf(sq[0] as (typeof FILES)[number]);
}

export function rankIndex(sq: Sq): number {
  return Number(sq[1]) - 1;
}

export function toSquare(file: number, rank: number): Sq | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${FILES[file]}${rank + 1}` as Sq;
}

/** Tile centre in board-local world space (y = top surface, handled by caller). */
export function tileToWorld(sq: Sq): { x: number; z: number } {
  const f = fileIndex(sq);
  const r = rankIndex(sq);
  return {
    x: (f - 3.5) * TILE,
    z: (3.5 - r) * TILE,
  };
}

export function worldToTile(x: number, z: number): Sq | null {
  const f = Math.round(x / TILE + 3.5);
  const r = Math.round(3.5 - z / TILE);
  return toSquare(f, r);
}

export function isLightSquare(sq: Sq): boolean {
  return (fileIndex(sq) + rankIndex(sq)) % 2 === 1;
}

export function squareColorName(sq: Sq): 'light' | 'dark' {
  return isLightSquare(sq) ? 'light' : 'dark';
}

/** Distance in tiles — used to size drop shadows / hop heights. */
export function tileDistance(a: Sq, b: Sq): number {
  return Math.max(Math.abs(fileIndex(a) - fileIndex(b)), Math.abs(rankIndex(a) - rankIndex(b)));
}

export function sameRank(a: Sq, b: Sq) {
  return a[1] === b[1];
}

/** Human friendly coordinate, e.g. "e4". */
export function sqLabel(sq: Sq) {
  return sq;
}
