/**
 * Persisted appearance + UX settings.
 *
 * A "theme" is a preset bundle; the customize panel can then override any single
 * axis (board style, piece style, location, palette) while keeping the rest.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  BOARD_STYLES,
  LOCATIONS,
  PIECE_STYLES,
  THEME_MAP,
  THEMES,
  type BoardStyleId,
  type LocationId,
  type PieceStyleId,
  type Theme,
} from '../data/styles';
import { CAMERA_VIEWS, type CameraViewId } from '../data/styles';

export type Quality = 'low' | 'medium' | 'high' | 'ultra';

export interface SettingsState {
  themeId: string;
  board: BoardStyleId;
  pieces: PieceStyleId;
  location: LocationId;
  accent: string;
  ui: Theme['ui'];
  quality: Quality;
  shadows: boolean;
  effects: boolean;
  reflections: boolean;
  fog: boolean;
  showCoords: boolean;
  showLegalMoves: boolean;
  showEvalBar: boolean;
  showClock: boolean;
  autoFlip: boolean;
  animateMoves: boolean;
  sound: boolean;
  cameraView: CameraViewId;
  boardTilt: number;
  pieceGlow: number;
  /** multiplier applied to the generated piece colours */
  pieceTint: string;
  /** multiplier applied to the generated board colours */
  boardTint: string;
  exposure: number;
  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  applyTheme: (themeId: string) => void;
  randomize: () => void;
  resetStyles: () => void;
}

const DEFAULT = THEMES[0];

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      themeId: DEFAULT.id,
      board: DEFAULT.board,
      pieces: DEFAULT.pieces,
      location: DEFAULT.location,
      accent: DEFAULT.accent,
      ui: DEFAULT.ui,
      quality: 'high',
      shadows: true,
      effects: true,
      reflections: true,
      fog: true,
      showCoords: true,
      showLegalMoves: true,
      showEvalBar: true,
      showClock: true,
      autoFlip: true,
      animateMoves: true,
      sound: true,
      cameraView: 'player',
      boardTilt: 0,
      pieceGlow: 1,
      pieceTint: '#ffffff',
      boardTint: '#ffffff',
      exposure: 1,

      set: (key, value) => {
        (set as unknown as (p: Partial<SettingsState>) => void)({ [key]: value } as Partial<SettingsState>);
        if (key === 'themeId') {
          const t = THEME_MAP[String(value)] ?? DEFAULT;
          (set as unknown as (p: Partial<SettingsState>) => void)({
            board: t.board,
            pieces: t.pieces,
            location: t.location,
            accent: t.accent,
            ui: t.ui,
          });
        }
      },

      applyTheme: (themeId) => {
        const t = THEME_MAP[themeId] ?? DEFAULT;
        set({
          themeId,
          board: t.board,
          pieces: t.pieces,
          location: t.location,
          accent: t.accent,
          ui: t.ui,
        } as Partial<SettingsState>);
      },

      randomize: () => {
        const t = THEMES[Math.floor(Math.random() * THEMES.length)];
        const boardKeys = Object.keys(BOARD_STYLES) as BoardStyleId[];
        const pieceKeys = Object.keys(PIECE_STYLES) as PieceStyleId[];
        const locKeys = Object.keys(LOCATIONS) as LocationId[];
        const mix = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
        set({
          themeId: t.id,
          board: mix(boardKeys),
          pieces: mix(pieceKeys),
          location: mix(locKeys),
          accent: t.accent,
          ui: t.ui,
        } as Partial<SettingsState>);
      },

      resetStyles: () => {
        const cur = get();
        const t = THEME_MAP[cur.themeId] ?? DEFAULT;
        set({
          board: t.board,
          pieces: t.pieces,
          location: t.location,
          accent: t.accent,
          ui: t.ui,
          cameraView: 'player',
          boardTilt: 0,
          pieceTint: '#ffffff',
          boardTint: '#ffffff',
          exposure: 1,
        } as Partial<SettingsState>);
      },
    }),
    {
      name: 'chess3d.settings.v1',
      partialize: (s) =>
        ({
          themeId: s.themeId,
          board: s.board,
          pieces: s.pieces,
          location: s.location,
          accent: s.accent,
          ui: s.ui,
          quality: s.quality,
          shadows: s.shadows,
          effects: s.effects,
          reflections: s.reflections,
          fog: s.fog,
          showCoords: s.showCoords,
          showLegalMoves: s.showLegalMoves,
          showEvalBar: s.showEvalBar,
          autoFlip: s.autoFlip,
          animateMoves: s.animateMoves,
          sound: s.sound,
          cameraView: s.cameraView,
          boardTilt: s.boardTilt,
          pieceGlow: s.pieceGlow,
          pieceTint: s.pieceTint,
          boardTint: s.boardTint,
          exposure: s.exposure,
        }) as Partial<SettingsState>,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!CAMERA_VIEWS.some((v) => v.id === state.cameraView)) {
          (state as Partial<SettingsState>).cameraView = 'player';
        }
        if (!THEME_MAP[state.themeId]) (state as Partial<SettingsState>).themeId = DEFAULT.id;
      },
    },
  ),
);

/** Push the theme palette into CSS custom properties (drives the DOM chrome). */
export function applyUiTheme(ui: Theme['ui'], accent: string) {
  const root = document.documentElement;
  root.style.setProperty('--bg', ui.bg);
  root.style.setProperty('--panel', ui.panel);
  root.style.setProperty('--text', ui.text);
  root.style.setProperty('--subtle', ui.subtle);
  root.style.setProperty('--border', ui.border);
  root.style.setProperty('--accent', accent);
  root.classList.toggle('light-ui', isLightColor(ui.bg));
}

function isLightColor(hex: string) {
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
}

export const settingsSnapshot = () => useSettings.getState();
