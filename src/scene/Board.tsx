/**
 * The board: 64 physical tiles, an extruded frame with inlay, coordinates on all
 * four edges, and the interaction plane that turns raycast hits into squares.
 */
import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { isLightSquare, tileToWorld } from '../game/board';
import { ALL_SQUARES, type Sq } from '../game/types';
import type { GameController } from '../game/controller';
import { useSettings } from '../state/settings';
import { useSession } from '../state/session';
import { BOARD_STYLES } from '../data/styles';
import { useBoardMaterials, useHighlightMaterials } from './materials';
import { frameGeometry, inlayGeometry, overlayGeo, plinthGeometry, tileGeometry } from './geo';
import { BOARD_TOP, squareFromUv } from './layout';
import { labelTexture, radialTexture, ringTexture } from './textures';

const SQUARES = ALL_SQUARES as Sq[];

function Tile({ sq, geo, mats, relief }: { sq: Sq; geo: THREE.BufferGeometry; mats: { tileLight: THREE.Material; tileDark: THREE.Material }; relief: number }) {
  const light = isLightSquare(sq);
  const { x, z } = tileToWorld(sq);
  return (
    <mesh geometry={geo} material={light ? mats.tileLight : mats.tileDark} position={[x, light ? relief * 0.012 : 0, z]} receiveShadow castShadow />
  );
}

function CoordLabels({ color }: { color: string }) {
  const show = useSettings((s) => s.showCoords);
  const items = useMemo(() => {
    if (!show) return [];
    const out: { key: string; text: string; pos: [number, number, number]; rot: number }[] = [];
    const outer = 4.31;
    SQUARES.filter((sq) => sq[1] === '1').forEach((sq, i) => {
      out.push({ key: `f${i}`, text: 'abcdefgh'[i], pos: [i - 3.5, BOARD_TOP + 0.02, outer], rot: Math.PI });
      out.push({ key: `f${i}t`, text: 'abcdefgh'[i], pos: [i - 3.5, BOARD_TOP + 0.02, -outer], rot: 0 });
    });
    for (let i = 0; i < 8; i++) {
      out.push({ key: `r${i}`, text: String(i + 1), pos: [-outer, BOARD_TOP + 0.02, 3.5 - i], rot: Math.PI / 2 });
      out.push({ key: `r${i}t`, text: String(i + 1), pos: [outer, BOARD_TOP + 0.02, 3.5 - i], rot: -Math.PI / 2 });
    }
    return out;
  }, [show]);

  if (!items.length) return null;
  return (
    <group>
      {items.map((it) => (
        <mesh key={it.key} position={it.pos} rotation={[-Math.PI / 2, 0, it.rot]} geometry={overlayGeo}>
          <meshBasicMaterial map={labelTexture(it.text, color)} transparent opacity={0.75} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

interface OverlayProps {
  sq: Sq;
  texture: THREE.Texture;
  color: string;
  opacity: number;
  size?: number;
  y?: number;
  pulse?: number;
}

function Overlay({ sq, texture, color, opacity, size = 1, y = 0, pulse = 0 }: OverlayProps) {
  const ref = useRef<THREE.Mesh>(null);
  const { x, z } = tileToWorld(sq);
  useFrame((state) => {
    if (!ref.current || !pulse) return;
    const t = state.clock.elapsedTime;
    const s = size * (1 + Math.sin(t * 3.4) * pulse);
    ref.current.scale.set(s, 1, s);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity * (0.8 + Math.sin(t * 3.4) * 0.2);
  });
  return (
    <mesh ref={ref} geometry={overlayGeo} position={[x, BOARD_TOP + 0.006 + y, z]} rotation={[0, 0, 0]} scale={[size, 1, size]}>
      <meshBasicMaterial map={texture} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export function Board({ game, interactive }: { game: GameController | null; interactive: boolean }) {
  const boardId = useSettings((s) => s.board);
  const locationId = useSettings((s) => s.location);
  const accent = useSettings((s) => s.accent);
  const showLegal = useSettings((s) => s.showLegalMoves);
  const tint = useSettings((st) => st.boardTint);
  const style = BOARD_STYLES[boardId] ?? BOARD_STYLES.walnut;
  const mats = useBoardMaterials(boardId, locationId, tint);
  const hl = useHighlightMaterials(accent);

  const tileGeo = useMemo(() => tileGeometry(style.relief), [style.relief]);
  // the 64 tiles never change during a game: keep the element array identical so
  // React bails out of reconciling them on every controller emit (hover, clock…)
  const tiles = useMemo(
    () => SQUARES.map((sq) => <Tile key={sq} sq={sq} geo={tileGeo} mats={mats} relief={style.relief} />),
    [tileGeo, mats, style.relief],
  );
  const frame = useMemo(() => frameGeometry(), []);
  const inlay = useMemo(() => inlayGeometry(style.coords ? 0.05 : 0.03), [style.coords]);
  const plinth = useMemo(() => plinthGeometry(), []);

  const ring = useMemo(() => ringTexture('#ffffff', 0.07), []);
  const dot = useMemo(() => radialTexture('dot', '#ffffff', 0.02, 3.4), []);

  const downSquare = useRef<Sq | null>(null);
  const gl = useRef<THREE.WebGLRenderer | null>(null);

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    if (!game || !interactive) return;
    e.stopPropagation();
    const sq = squareFromUv(e.uv) as Sq | null;
    downSquare.current = sq;
    if (!sq) {
      game.clearSelection();
      return;
    }
    if (game.selection && game.targets.has(sq)) {
      game.playHuman(game.selection, sq);
      return;
    }
    const piece = game.pieceAt(sq);
    if (piece && piece.color === game.turn && game.humanCanMove()) game.beginDrag(sq);
    else game.clearSelection();
  };

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    if (!game) return;
    const sq = squareFromUv(e.uv) as Sq | null;
    game.setHover(sq);
    const el = (e.nativeEvent.target as HTMLElement | null)?.closest?.('canvas') as HTMLElement | null;
    if (el) {
      const canGrab = !!sq && game.humanCanMove() && (!!game.pieceAt(sq) || (game.selection && game.targets.has(sq)));
      el.style.cursor = canGrab ? 'grab' : game.selection ? 'pointer' : 'default';
    }
  };

  const handleUp = (e: ThreeEvent<PointerEvent>) => {
    if (!game || !interactive) return;
    const sq = squareFromUv(e.uv) as Sq | null;
    if (game.dragging) game.endDrag(sq ?? downSquare.current);
    downSquare.current = null;
  };

  const targets = game && showLegal ? [...game.targets.keys()] : [];
  const captureTargets = game && showLegal ? targets.filter((t) => !!game.targets.get(t)?.captured || !!game.pieceAt(t)) : [];
  const quietTargets = targets.filter((t) => !captureTargets.includes(t));

  const liveOrientation = useSession((st) => st.game?.orientation ?? 'w');
  const rootRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = rootRef.current;
    if (!g) return;
    const target = liveOrientation === 'b' ? Math.PI : 0;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, target, 5, dt);
  });

  return (
    <group ref={rootRef}>
      {/* interaction plane — UV based, so it works at any camera/board rotation */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, BOARD_TOP + 0.002, 0]}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
      >
        <planeGeometry args={[8.6, 8.6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {tiles}

      <mesh geometry={frame} material={mats.frame} position={[0, 0, 0]} castShadow receiveShadow />
      <mesh geometry={inlay} material={mats.inlay} />
      <mesh geometry={plinth} material={mats.plinth} position={[0, -0.02, 0]} receiveShadow castShadow />

      <CoordLabels color={style.coords ? '#f4ead8' : accent} />

      {game?.lastMove && <Overlay sq={game.lastMove.from} texture={dot} color={accent} opacity={0.3} size={0.98} />}
      {game?.lastMove && <Overlay sq={game.lastMove.to} texture={dot} color={accent} opacity={0.42} size={0.98} />}
      {game?.selection && <Overlay sq={game.selection} texture={ring} color={accent} opacity={0.85} size={0.94} pulse={0.03} />}
      {game?.hint && <Overlay sq={game.hint.from} texture={ring} color="#7cf6c8" opacity={0.6} size={0.9} pulse={0.05} />}
      {game?.hint && <Overlay sq={game.hint.to} texture={ring} color="#7cf6c8" opacity={0.9} size={0.72} pulse={0.05} />}
      {game?.checkSquare && <Overlay sq={game.checkSquare} texture={radialTexture('check', '#ff5050', 0.25, 2)} color="#ff4040" opacity={0.85} size={1.25} pulse={0.08} />}
      {quietTargets.map((t) => (
        <Overlay key={`q${t}`} sq={t} texture={dot} color="#ffffff" opacity={0.5} size={0.42} />
      ))}
      {captureTargets.map((t) => (
        <Overlay key={`c${t}`} sq={t} texture={ring} color="#ff6b6b" opacity={0.8} size={0.92} />
      ))}
      {game?.hover && game.dragging && game.targets.has(game.hover) && (
        <Overlay sq={game.hover} texture={dot} color={accent} opacity={0.6} size={1.1} />
      )}
    </group>
  );
}

