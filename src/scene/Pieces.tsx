/**
 * The 32 pieces. Positions are damped toward their target square every frame, so
 * a move becomes a slide + hop instead of a teleport; captured pieces topple and
 * sink into the board.
 */
import * as THREE from 'three';
import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { tileToWorld } from '../game/board';
import type { GameController } from '../game/controller';
import type { TrackedPiece } from '../game/types';
import { PIECE_STYLES, type PieceStyleId } from '../data/styles';
import { buildPiece } from './pieceGeometry';
import { usePieceMaterials } from './materials';
import { useSettings } from '../state/settings';
import { BOARD_TOP, LIFT, PIECE_SCALE } from './layout';

interface PieceProps {
  piece: TrackedPiece;
  game: GameController;
  styleId: PieceStyleId;
  mats: ReturnType<typeof usePieceMaterials>;
  animate: boolean;
}

const targetTmp = new THREE.Vector3();

const PieceView = memo(function PieceView({ piece, game, styleId, mats, animate }: PieceProps) {
  const group = useRef<THREE.Group>(null);
  const spin = useRef(0);
  const style = PIECE_STYLES[styleId];
  const built = useMemo(() => buildPiece(style, piece.type), [style, piece.type]);

  const isSelected = game.selection === piece.square;
  const isDragging = game.dragging && isSelected;
  const dropTarget = isDragging && game.hover && game.targets.get(game.hover) ? game.hover : null;
  const dest = dropTarget ?? piece.square;
  const { x, z } = tileToWorld(dest);
  const facing = piece.color === 'w' ? Math.PI : 0;

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const lift = isSelected ? LIFT : 0;
    targetTmp.set(x, BOARD_TOP + lift, z);
    const dur = animate ? (isSelected ? 0.07 : 0.16) : 0;
    const dist = Math.hypot(g.position.x - x, g.position.z - z);
    const hop = animate ? Math.min(0.3, dist * 0.5) * Math.sin(Math.PI * Math.min(1, dist * 1.4 + 0.12)) : 0;
    if (dur === 0) {
      g.position.copy(targetTmp);
      g.rotation.y = facing;
      g.rotation.z = 0;
      return;
    }
    easing.damp3(g.position, [targetTmp.x, targetTmp.y + hop, targetTmp.z], dur, dt);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, facing, 7, dt);

    // subtle idle bob for the selected piece, spin while it travels
    if (isSelected) {
      g.position.y += Math.sin(state.clock.elapsedTime * 4) * 0.012 + 0.02;
      spin.current = THREE.MathUtils.damp(spin.current, 0.35, 6, dt);
    } else {
      spin.current = THREE.MathUtils.damp(spin.current, 0, 8, dt);
    }
    g.rotation.y += spin.current * dt;
    const scale = isSelected ? PIECE_SCALE * 1.06 : PIECE_SCALE;
    easing.damp3(g.scale, [scale, scale, scale], 0.12, dt);
  });

  const bodyMat = piece.color === 'w' ? mats.lightBody : mats.darkBody;
  const accentMat = piece.color === 'w' ? mats.lightAccent : mats.darkAccent;

  return (
    <group ref={group} position={[x, BOARD_TOP, z]} rotation={[0, facing, 0]} scale={PIECE_SCALE}>
      <mesh geometry={built.body} material={bodyMat} castShadow receiveShadow />
      {built.accent && <mesh geometry={built.accent} material={accentMat} castShadow />}
    </group>
  );
});

/** A captured piece toppling over and sinking away. */
const GraveView = memo(function GraveView({
  entry,
  styleId,
  mats,
}: {
  entry: { piece: TrackedPiece; at: number; to: string };
  styleId: PieceStyleId;
  mats: ReturnType<typeof usePieceMaterials>;
}) {
  const group = useRef<THREE.Group>(null);
  const style = PIECE_STYLES[styleId];
  const built = useMemo(() => buildPiece(style, entry.piece.type), [style, entry.piece.type]);
  const { x, z } = tileToWorld(entry.piece.square);
  const dir = entry.piece.color === 'w' ? -1 : 1;

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const age = (performance.now() - entry.at) / 1000;
    const t = Math.min(1, age / 0.85);
    const eased = 1 - Math.pow(1 - t, 2.2);
    g.rotation.z = dir * eased * (Math.PI / 2) * 0.9;
    g.position.y = BOARD_TOP - eased * 0.22;
    g.position.x = x + eased * dir * 0.22;
    const s = PIECE_SCALE * Math.max(0, 1 - t * t * 1.15);
    g.scale.setScalar(Math.max(0.0001, s));
    g.visible = t < 0.995;
  });

  const bodyMat = entry.piece.color === 'w' ? mats.lightBody : mats.darkBody;

  return (
    <group ref={group} position={[x, BOARD_TOP, z]}>
      <mesh geometry={built.body} material={bodyMat} renderOrder={2} />
      {built.accent && <mesh geometry={built.accent} material={entry.piece.color === 'w' ? mats.lightAccent : mats.darkAccent} />}
    </group>
  );
});

export function Pieces({ game }: { game: GameController | null }) {
  const styleId = useSettings((s) => s.pieces);
  const tint = useSettings((s) => s.pieceTint);
  const animate = useSettings((s) => s.animateMoves);
  const glow = useSettings((s) => s.pieceGlow);
  const mats = usePieceMaterials(styleId, tint, glow);
  const style = PIECE_STYLES[styleId];
  const now = performance.now();
  const graves = game ? game.graves.filter((g) => now - g.at < 900) : [];

  if (!game) {
    // Attract mode on the home screen: a full set, no interaction.
    return null;
  }

  return (
    <group>
      {game.pieces.map((p) => (
        <PieceView key={p.id} piece={p} game={game} styleId={styleId} mats={mats} animate={animate} />
      ))}
      {graves.map((g) => (
        <GraveView key={`${g.piece.id}-${g.at}`} entry={g} styleId={styleId} mats={mats} />
      ))}
      {style.id === 'cyber' && game.pieces.length > 0 && (
        <pointLight position={[0, 1.4, 0]} intensity={2} distance={6} color={style.colors.darkAccent} />
      )}
    </group>
  );
}
