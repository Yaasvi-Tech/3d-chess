/**
 * Material factory: turns style data (board style, piece style, location, accent)
 * into three.js materials with the right procedural maps attached.
 */
import * as THREE from 'three';
import { useMemo } from 'react';
import { BOARD_STYLES, LOCATIONS, PIECE_STYLES, type BoardStyleId, type LocationId, type PieceStyleId } from '../data/styles';
import { gridGlowTexture, marbleTexture, roughnessNoise, stoneTexture, woodTexture } from './textures';

export interface BoardMaterials {
  tileLight: THREE.MeshPhysicalMaterial;
  tileDark: THREE.MeshPhysicalMaterial;
  frame: THREE.MeshPhysicalMaterial;
  plinth: THREE.MeshPhysicalMaterial;
  inlay: THREE.MeshStandardMaterial;
  styleId: BoardStyleId;
}

export interface PieceMaterials {
  lightBody: THREE.MeshPhysicalMaterial;
  darkBody: THREE.MeshPhysicalMaterial;
  lightAccent: THREE.MeshPhysicalMaterial;
  darkAccent: THREE.MeshPhysicalMaterial;
  styleId: PieceStyleId;
}

function finishPhysical(
  m: THREE.MeshPhysicalMaterial,
  opts: { roughness: number; metalness: number; clearcoat: number; transmission: number; ior: number; emissive?: number; emissiveColor?: string; flat?: boolean },
) {
  m.roughness = opts.roughness;
  m.metalness = opts.metalness;
  m.clearcoat = opts.clearcoat;
  m.clearcoatRoughness = Math.min(1, opts.roughness + 0.1);
  m.transmission = opts.transmission;
  m.thickness = opts.transmission > 0 ? 0.55 : 0;
  m.ior = opts.ior;
  m.flatShading = !!opts.flat;
  if (opts.emissive && opts.emissiveColor) {
    m.emissive = new THREE.Color(opts.emissiveColor);
    m.emissiveIntensity = opts.emissive;
  }
  m.envMapIntensity = 1.05;
  return m;
}

export function useBoardMaterials(boardId: BoardStyleId, locationId: LocationId, tint = '#ffffff'): BoardMaterials {
  return useMemo(() => {
    const style = BOARD_STYLES[boardId] ?? BOARD_STYLES.walnut;
    const loc = LOCATIONS[locationId] ?? LOCATIONS.grandHall;
    const tintMul = (c: string) => new THREE.Color(c).multiply(new THREE.Color(tint));
    const isWood = boardId === 'walnut' || boardId === 'sandstone';
    const isStone = boardId === 'marble' || boardId === 'jade' || boardId === 'obsidian' || boardId === 'sandstone';
    const map = isWood
      ? woodTexture(boardId, style.light, style.dark, style.jitter)
      : isStone
        ? marbleTexture(boardId, style.light, style.dark, boardId === 'marble' ? 1 : 0.7)
        : stoneTexture(boardId, style.light, 0.7);
    const frameMap = isWood ? woodTexture(`${boardId}-frame`, style.frame, '#000000', 0.12) : undefined;
    const rough = roughnessNoise(`${boardId}-r`, 0.4, 32);

    const mkTile = (color: string) => {
      const m = new THREE.MeshPhysicalMaterial({ color: tintMul(color) });
      m.map = map;
      m.roughnessMap = rough;
      finishPhysical(m, {
        roughness: style.roughness,
        metalness: style.metalness,
        clearcoat: style.clearcoat,
        transmission: style.transmission,
        ior: style.ior,
      });
      if (style.emissive > 0.2) {
        m.emissiveMap = gridGlowTexture(color, style.emissiveColor, style.gridLines);
        m.emissive = new THREE.Color(style.emissiveColor);
        m.emissiveIntensity = style.emissive * 0.7;
      }
      m.side = THREE.FrontSide;
      return m;
    };

    const tileLight = mkTile(style.light);
    const tileDark = mkTile(style.dark);

    const frame = new THREE.MeshPhysicalMaterial({ color: tintMul(style.frame) });
    if (frameMap) frame.map = frameMap;
    finishPhysical(frame, {
      roughness: Math.min(1, style.roughness + 0.12),
      metalness: style.metalness + (boardId === 'vinylSteel' ? 0.2 : 0),
      clearcoat: style.clearcoat * 0.8,
      transmission: 0,
      ior: style.ior,
    });

    const plinth = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(style.frameAccent).multiplyScalar(0.5) });
    finishPhysical(plinth, { roughness: 0.55, metalness: 0.25, clearcoat: 0.2, transmission: 0, ior: 1.4 });
    plinth.roughness = Math.max(0.25, loc.table.roughness * 0.8);

    const inlay = new THREE.MeshStandardMaterial({
      color: new THREE.Color(style.frameAccent),
      emissive: new THREE.Color(style.emissiveColor),
      emissiveIntensity: style.emissive,
      roughness: 0.35,
      metalness: 0.6,
    });

    return { tileLight, tileDark, frame, plinth, inlay, styleId: boardId };
  }, [boardId, locationId, tint]);
}

export function usePieceMaterials(piecesId: PieceStyleId, tint = '#ffffff', glow = 1): PieceMaterials {
  return useMemo(() => {
    const style = PIECE_STYLES[piecesId] ?? PIECE_STYLES.staunton;
    const mul = (c: string) => new THREE.Color(c).multiply(new THREE.Color(tint));
    const mk = (color: string, accentColor: string, isAccent: boolean) => {
      const m = new THREE.MeshPhysicalMaterial({ color: mul(accentColor && isAccent ? accentColor : color) });
      finishPhysical(m, {
        roughness: isAccent ? Math.max(0.08, style.roughness * 0.6) : style.roughness,
        metalness: isAccent ? Math.min(1, style.metalness + 0.35) : style.metalness,
        clearcoat: style.clearcoat,
        transmission: isAccent ? 0 : style.transmission,
        ior: 1.6,
        flat: style.flatShading,
        emissive: isAccent ? style.emissive * glow : style.emissive * 0.08,
        emissiveColor: isAccent ? accentColor : style.colors.lightAccent,
      });
      if (style.id === 'staunton') {
        // turned ivory/ebony reads through roughness and clearcoat, not a colour
        // map: a grain texture wraps around the lathe and looks like a coil
        m.roughnessMap = roughnessNoise(`piece-turn-${color}`, 0.22, 22);
      }
      if (style.id === 'marble') {
        m.map = marbleTexture(`piece-${style.id}-${color}`, color, '#ffffff', 0.55);
        m.roughnessMap = roughnessNoise(`piece-${color}`, 0.5, 18);
      } else if (style.id === 'carved') {
        m.map = stoneTexture(`piece-${color}`, color, 0.35);
      }
      if (isAccent && style.emissive > 0) {
        m.emissiveIntensity = style.emissive;
        m.toneMapped = false;
      }
      return m;
    };
    return {
      lightBody: mk(style.colors.light, style.colors.lightAccent, false),
      lightAccent: mk(style.colors.light, style.colors.lightAccent, true),
      darkBody: mk(style.colors.dark, style.colors.darkAccent, false),
      darkAccent: mk(style.colors.dark, style.colors.darkAccent, true),
      styleId: piecesId,
    };
  }, [piecesId, tint, glow]);
}

/** Highlight materials for the overlay quads on the board surface. */
export function useHighlightMaterials(accent: string) {
  return useMemo(() => {
    const mk = (color: string, opacity: number, blending: THREE.Blending = THREE.AdditiveBlending, depthWrite = false) =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity,
        blending,
        depthWrite,
        toneMapped: false,
      });
    return {
      selection: mk(accent, 0.5),
      target: mk('#ffffff', 0.32),
      capture: mk('#ff5d5d', 0.55),
      last: mk(accent, 0.22),
      check: mk('#ff4d4d', 0.6),
      hover: mk('#ffffff', 0.16),
      hint: mk('#7cf6c8', 0.5),
    };
  }, [accent]);
}

export const groundMaterial = (loc: LocationId) => {
  const style = LOCATIONS[loc] ?? LOCATIONS.grandHall;
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(style.ground.color),
    roughness: style.ground.roughness,
    metalness: style.ground.metalness,
  });
};
