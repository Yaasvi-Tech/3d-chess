import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Chess } from 'chess.js';
import { BOARD_STYLES, LOCATIONS, PIECE_STYLES, THEMES, type BoardStyleId, type LocationId, type PieceStyleId } from '../src/data/styles';
import { buildPiece, PIECE_TYPES } from '../src/scene/pieceGeometry';
import { inlayGeometry, frameGeometry, plinthGeometry, tileGeometry } from '../src/scene/geo';
import { bannerTexture, bookTexture, gridGlowTexture, labelTexture, lavaTexture, marbleTexture, radialTexture, ringTexture, roughnessNoise, screenTexture, skyTexture, stoneTexture, woodTexture } from '../src/scene/textures';
import { trackedFromBoard, applyMoveToPieces } from '../src/game/pieces';

function checkGeometry(g: THREE.BufferGeometry, label: string) {
  const pos = g.getAttribute('position');
  expect(pos, `${label}: has positions`).toBeTruthy();
  expect(pos.count, `${label}: vertex count`).toBeGreaterThanOrEqual(12);
  for (let i = 0; i < pos.count * 3; i++) {
    if (!Number.isFinite(pos.array[i])) throw new Error(`${label}: NaN at vertex component ${i}`);
  }
  g.computeBoundingSphere();
  expect(g.boundingSphere?.radius ?? 0).toBeGreaterThan(0.02);
  expect(Number.isFinite(g.boundingSphere!.radius)).toBe(true);
}

describe('procedural piece geometry', () => {
  const styles = Object.keys(PIECE_STYLES) as PieceStyleId[];
  it.each(styles)('builds every piece for the %s style', (id) => {
    for (const type of PIECE_TYPES) {
      const built = buildPiece(PIECE_STYLES[id], type);
      expect(built.mergeFailed, `${id}/${type} merge`).toBe(false);
      checkGeometry(built.body, `${id}/${type} body`);
      if (built.accent) checkGeometry(built.accent, `${id}/${type} accent`);
      // the king must be the tallest and a pawn the shortest — silhouettes must read
      const heights = PIECE_TYPES.map((t) => buildPiece(PIECE_STYLES[id], t).height);
      expect(heights[PIECE_TYPES.indexOf('k')]).toBeGreaterThan(heights[PIECE_TYPES.indexOf('p')]);
      expect(built.radius).toBeGreaterThan(0.2);
      expect(built.radius).toBeLessThan(0.5);
    }
  });

  it('merges every multi-part piece', () => {
    for (const id of Object.keys(PIECE_STYLES) as PieceStyleId[]) {
      for (const type of PIECE_TYPES) {
        expect(buildPiece(PIECE_STYLES[id], type).mergeFailed, `${id}/${type}`).toBe(false);
      }
    }
  });

  it('caches built geometry so remounts are free', () => {
    const a = buildPiece(PIECE_STYLES.staunton, 'n');
    const b = buildPiece(PIECE_STYLES.staunton, 'n');
    expect(a).toBe(b);
  });

  it('gives the knight a forward-facing head', () => {
    const built = buildPiece(PIECE_STYLES.staunton, 'n');
    built.body.computeBoundingBox();
    const bb = built.body.boundingBox!;
    expect(bb.max.z).toBeGreaterThan(0.1);
    expect(Number.isFinite(bb.min.y)).toBe(true);
    expect(bb.min.y).toBeGreaterThanOrEqual(-1e-6);
  });
});

describe('board geometry and textures', () => {
  it('builds frame, tiles, inlay and plinth without degenerate data', () => {
    checkGeometry(tileGeometry(0.35), 'tile');
    checkGeometry(tileGeometry(0), 'flat tile');
    checkGeometry(frameGeometry(), 'frame');
    checkGeometry(inlayGeometry(), 'inlay');
    checkGeometry(plinthGeometry(), 'plinth');
  });

  it('generates every texture style used by the catalog', () => {
    const ids = Object.keys(BOARD_STYLES) as BoardStyleId[];
    for (const id of ids) {
      const s = BOARD_STYLES[id];
      expect(new THREE.Color(s.light).getHex()).not.toBe(0x000000);
      expect(woodTexture(id, s.light, s.dark, s.jitter)).toBeTruthy();
      expect(marbleTexture(id, s.light, s.dark, 1)).toBeTruthy();
      expect(stoneTexture(id, s.dark, 0.6)).toBeTruthy();
      expect(roughnessNoise(id, 0.3, 32)).toBeTruthy();
      expect(gridGlowTexture(s.light, s.emissiveColor, s.gridLines)).toBeTruthy();
    }
    expect(labelTexture('e', '#fff')).toBeTruthy();
    expect(radialTexture('r', '#fff')).toBeTruthy();
    expect(ringTexture('#fff')).toBeTruthy();
    expect(bannerTexture()).toBeTruthy();
    expect(bookTexture(1)).toBeTruthy();
    expect(lavaTexture('l')).toBeTruthy();
    expect(screenTexture('s', 'x')).toBeTruthy();
    const loc = LOCATIONS[Object.keys(LOCATIONS)[0] as LocationId];
    expect(skyTexture(loc.sky[0], loc.sky[1], loc.sky[2])).toBeTruthy();
  });

  it('every theme references styles that exist', () => {
    for (const t of THEMES) {
      expect(BOARD_STYLES[t.board], t.id).toBeTruthy();
      expect(PIECE_STYLES[t.pieces], t.id).toBeTruthy();
      expect(LOCATIONS[t.location], t.id).toBeTruthy();
      expect(t.ui.bg).toMatch(/^#/);
    }
    expect(Object.keys(LOCATIONS).length).toBeGreaterThanOrEqual(8);
    expect(Object.keys(PIECE_STYLES).length).toBeGreaterThanOrEqual(6);
    expect(Object.keys(BOARD_STYLES).length).toBeGreaterThanOrEqual(8);
  });
});

describe('tracked piece identities', () => {
  it('keeps ids across a normal move and marks the mover', () => {
    const chess = new Chess();
    let pieces = trackedFromBoard(chess);
    expect(pieces).toHaveLength(32);
    const before = pieces.find((p) => p.square === 'e2')!;
    const mv = chess.move('e4');
    ({ pieces } = applyMoveToPieces(pieces, mv as never));
    const after = pieces.find((p) => p.square === 'e4')!;
    expect(after.id).toBe(before.id);
    expect(after.justMoved).toBe(true);
    expect(pieces.find((p) => p.square === 'e2')).toBeUndefined();
    expect(pieces).toHaveLength(32);
  });

  it('removes the captured piece and remembers it for the topple animation', () => {
    const chess = new Chess('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
    let pieces = trackedFromBoard(chess);
    const mv = chess.move('exd5');
    const diff = applyMoveToPieces(pieces, mv as never);
    pieces = diff.pieces;
    expect(pieces).toHaveLength(31);
    expect(diff.captured?.type).toBe('p');
    expect(diff.captured?.color).toBe('b');
  });

  it('moves the rook on castling and the taken pawn on en passant', () => {
    const chess = new Chess('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
    let pieces = trackedFromBoard(chess);
    const mv = chess.move('O-O') as never;
    const diff = applyMoveToPieces(pieces, mv);
    pieces = diff.pieces;
    expect(pieces.find((p) => p.square === 'g1')?.type).toBe('k');
    expect(pieces.find((p) => p.square === 'f1')?.type).toBe('r');
    expect(pieces.find((p) => p.square === 'h1')).toBeUndefined();
    expect(diff.aux?.from).toBe('h1');

    const epStart = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';
    const ep = new Chess(epStart);
    const beforeEp = trackedFromBoard(new Chess(epStart));
    const epMv = ep.move('exd6') as never;
    const realDiff = applyMoveToPieces(beforeEp, epMv);
    expect(realDiff.captured?.square).toBe('d5');
    expect(realDiff.pieces).toHaveLength(31);
    expect(realDiff.pieces.find((p) => p.square === 'd6')?.type).toBe('p');
    expect(realDiff.pieces.find((p) => p.square === 'd5')).toBeUndefined();
  });

  it('promotes by changing the type but keeping the id', () => {
    const chess = new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    const before = trackedFromBoard(chess);
    const mv = chess.move('a8=Q') as never;
    const after = applyMoveToPieces(before, mv).pieces;
    const promoted = after.find((p) => p.square === 'a8')!;
    expect(promoted.type).toBe('q');
    expect(promoted.id).toBe(before.find((p) => p.square === 'a7')!.id);
  });
});
