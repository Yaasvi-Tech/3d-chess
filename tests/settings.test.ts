/**
 * The style system is the product: themes have to write every axis, unknown
 * (persisted) ids must degrade instead of blanking the stage, and time controls
 * must agree with the clocks.
 */
import { describe, expect, it } from 'vitest';
import {
  BOARD_STYLES,
  LOCATIONS,
  PIECE_STYLES,
  THEMES,
  TIME_CONTROLS,
  boardStyleOf,
  locationOf,
  pieceStyleOf,
  themeOf,
} from '../src/data/styles';
import { useSettings } from '../src/state/settings';
import { clockFor, DEFAULT_MATCH, type MatchConfig } from '../src/state/session';

const snapshot = () => {
  const s = useSettings.getState();
  return { board: s.board, pieces: s.pieces, location: s.location, accent: s.accent, ui: s.ui };
};

describe('themes', () => {
  it('starts on the first curated theme', () => {
    expect(snapshot()).toEqual({
      board: THEMES[0].board,
      pieces: THEMES[0].pieces,
      location: THEMES[0].location,
      accent: THEMES[0].accent,
      ui: THEMES[0].ui,
    });
  });

  it('applying a theme writes every style axis at once', () => {
    for (const theme of THEMES) {
      useSettings.getState().applyTheme(theme.id);
      expect(snapshot()).toEqual({
        board: theme.board,
        pieces: theme.pieces,
        location: theme.location,
        accent: theme.accent,
        ui: theme.ui,
      });
    }
  });

  it('falls back to the default theme for an unknown id', () => {
    useSettings.getState().applyTheme('from-a-deleted-build');
    const s = useSettings.getState();
    expect(s.board).toBe(THEMES[0].board);
    expect(s.location).toBe(THEMES[0].location);
  });

  it('randomize keeps every axis inside the catalog', () => {
    for (let i = 0; i < 25; i++) {
      useSettings.getState().randomize();
      const s = useSettings.getState();
      expect(BOARD_STYLES).toHaveProperty(s.board);
      expect(PIECE_STYLES).toHaveProperty(s.pieces);
      expect(LOCATIONS).toHaveProperty(s.location);
    }
  });

  it('resetStyles returns to the theme and the default camera dress', () => {
    const set = useSettings.getState().set;
    set('board', 'neon' as never);
    set('boardTilt', 0.5);
    set('pieceTint', '#ff0000');
    useSettings.getState().resetStyles();
    const s = useSettings.getState();
    const theme = themeOf(s.themeId);
    expect(s.board).toBe(theme.board);
    expect(s.pieces).toBe(theme.pieces);
    expect(s.location).toBe(theme.location);
    expect(s.boardTilt).toBe(0);
    expect(s.pieceTint).toBe('#ffffff');
    expect(s.cameraView).toBe('player');
  });
});

describe('style lookups', () => {
  it('never fail on an id that no longer exists', () => {
    expect(boardStyleOf('__gone__')).toBe(BOARD_STYLES.walnut);
    expect(pieceStyleOf('__gone__')).toBe(PIECE_STYLES.staunton);
    expect(locationOf('__gone__')).toBe(LOCATIONS.grandHall);
    expect(themeOf('__gone__')).toBe(THEMES[0]);
    // ...and still resolve real ones
    expect(boardStyleOf('jade')).toBe(BOARD_STYLES.jade);
    expect(pieceStyleOf('crystal')).toBe(PIECE_STYLES.crystal);
    expect(locationOf('moonDeck')).toBe(LOCATIONS.moonDeck);
  });
});

describe('time controls', () => {
  const cfg = (patch: Partial<MatchConfig>): MatchConfig => ({ ...DEFAULT_MATCH, ...patch });

  it('enables the clock for timed controls only when asked', () => {
    for (const tc of TIME_CONTROLS.filter((t) => t.baseMs > 0)) {
      const on = clockFor(cfg({ timeControl: tc.id, clockEnabled: true }));
      expect(on.enabled, tc.id).toBe(true);
      expect(on.baseMs, tc.id).toBe(tc.baseMs);
      expect(on.incMs, tc.id).toBe(tc.incMs);
      expect(clockFor(cfg({ timeControl: tc.id, clockEnabled: false })).enabled, tc.id).toBe(false);
    }
  });

  it('keeps untimed untimed, and always gives a usable base', () => {
    const off = clockFor(cfg({ timeControl: 'untimed', clockEnabled: true }));
    expect(off.enabled).toBe(false);
    expect(off.baseMs).toBeGreaterThan(0);
    expect(clockFor(cfg({ timeControl: 'nope' as never })).baseMs).toBe(TIME_CONTROLS[2].baseMs);
  });
});
