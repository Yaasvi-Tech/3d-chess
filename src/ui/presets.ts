/** Re-exports the style catalog for the UI layer, plus a few UI-only helpers. */
import { LEVELS } from '../game/ai/engineCore';
export { THEMES, TIME_CONTROLS, LOCATIONS, BOARD_STYLES, PIECE_STYLES, CAMERA_VIEWS } from '../data/styles';
export type { Theme, BoardStyleId, PieceStyleId, LocationId, TimeControlId, CameraViewId } from '../data/styles';

export const LEVELS_UI = LEVELS.map((l) => ({
  value: l.key,
  label: l.name,
  title: `${l.blurb} · ~${l.elo} Elo`,
}));

export const LEVEL_INFO = LEVELS;

export const ACCENT_SWATCHES = [
  '#9fc4ff',
  '#c9a86a',
  '#25f4ee',
  '#a8e6ff',
  '#6fd7a8',
  '#ff9d5c',
  '#e0b64a',
  '#ff5a1f',
  '#8ea3b4',
  '#ff6b9d',
  '#c58cff',
];
