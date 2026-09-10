/**
 * The persistent 3D stage. One Canvas lives for the whole app session — screens
 * only swap the DOM chrome around it, so changing theme or location never
 * re-creates the renderer.
 */
import * as THREE from 'three';
import { Suspense, memo, useEffect, useMemo } from 'react';

import { Canvas, useThree } from '@react-three/fiber';
import { AdaptiveDpr, Environment, Lightformer, SoftShadows } from '@react-three/drei';
import { Board } from './Board';
import { Pieces } from './Pieces';
import { World } from './World';
import { Rig } from './Rig';
import { Effects } from './Effects';
import { useSettings } from '../state/settings';
import { useSession, getDemoGame } from '../state/session';
import { useGame } from '../hooks/useGame';
import { boardStyleOf, locationOf } from '../data/styles';
import { PLINTH_HEIGHT } from './layout';

function RendererTuning() {
  const locationId = useSettings((s) => s.location);
  const quality = useSettings((s) => s.quality);
  const fog = useSettings((s) => s.fog);
  const exposure = useSettings((s) => s.exposure);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const loc = locationOf(locationId);
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = loc.tone * (1 + (exposure - 1));
    gl.shadowMap.type = quality === 'low' ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
  }, [gl, loc.tone, quality, exposure]);
  useEffect(() => {
    if (fog) {
      scene.fog = new THREE.FogExp2(new THREE.Color(loc.fogColor), loc.fogDensity);
    } else {
      scene.fog = null;
    }
    scene.background = null;
    return () => {
      scene.fog = null;
    };
  }, [scene, loc.fogColor, loc.fogDensity, fog]);
  return null;
}

/** Environment map built from area lights, so metals/glass have something to reflect. */
const StageEnvironment = memo(function StageEnvironment({ locationId }: { locationId: string }) {
  const loc = locationOf(locationId);
  const quality = useSettings((s) => s.quality);
  const res = quality === 'low' ? 64 : quality === 'medium' ? 128 : 256;
  return (
    <Environment resolution={res} frames={1} background={false}>
      <color attach="background" args={[loc.sky[1]]} />
      <Lightformer intensity={2.6} color={loc.sun.color} position={[0, 8, -6]} scale={[14, 7, 1]} target={[0, 0, 0]} />
      <Lightformer intensity={1.5} color={loc.rim[0]?.color ?? '#ffffff'} position={[-8, 3, 4]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} />
      <Lightformer intensity={1.2} color={loc.rim[1]?.color ?? '#ffffff'} position={[8, 2.4, 4]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} />
      <Lightformer intensity={0.6} color={loc.ground.color} position={[0, -4, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
    </Environment>
  );
});

export function Scene() {
  const screen = useSession((s) => s.screen);
  const liveGame = useSession((s) => s.game);
  const preview = useSession((s) => s.preview);
  const locationId = useSettings((s) => s.location);
  const boardId = useSettings((s) => s.board);
  const quality = useSettings((s) => s.quality);
  const shadowsOn = useSettings((s) => s.shadows);

  const demo = useMemo(() => (screen === 'home' || screen === 'customize' || screen === 'tournaments' ? getDemoGame() : null), [screen]);
  const game = useGame(preview ?? liveGame ?? demo);
  const interactive = screen === 'play' && !!liveGame && !preview;
  const loc = locationOf(locationId);
  // the board's plinth rests on the table top, so the tiles start one plinth higher
  const boardY = loc.table.height + PLINTH_HEIGHT - 0.01;
  const boardStyle = boardStyleOf(boardId);
  const dpr: [number, number] = quality === 'low' ? [0.75, 1] : quality === 'medium' ? [1, 1.35] : quality === 'high' ? [1, 1.75] : [1, 2];

  return (
    <Canvas
      shadows={shadowsOn}
      dpr={dpr}
      frameloop="always"
      gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', alpha: false, stencil: false }}
      camera={{ position: [0, 7.4, 9.2], fov: 42, near: 0.5, far: 260 }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color(loc.sky[2]));
      }}
    >
      <RendererTuning />
      {quality === 'ultra' && <SoftShadows size={24} samples={12} focus={0.85} />}
      <Suspense fallback={null}>
        <StageEnvironment key={`env-${locationId}`} locationId={locationId} />
        <World key={locationId} locationId={locationId} />
        <group position={[0, boardY, 0]}>
          <Board game={game} interactive={interactive} />
          <Pieces game={game} />
        </group>
        <Rig boardY={boardY} idle={screen === 'home'} locked={!!liveGame?.dragging} />
        <Effects />
      </Suspense>
      <AdaptiveDpr pixelated />

    </Canvas>
  );
}
