/**
 * Camera rig: preset views with a damped transition, plus OrbitControls for free
 * looking. "Cinematic" adds a slow auto-orbit for screenshots and attract mode.
 */
import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { easing } from 'maath';
import { CAMERA_VIEWS } from '../data/styles';
import { useSettings } from '../state/settings';

export function Rig({ boardY, idle }: { boardY: number; idle?: boolean }) {
  const view = useSettings((s) => s.cameraView);
  const tilt = useSettings((s) => s.boardTilt);
  const controls = useRef<React.ComponentRef<typeof OrbitControls> | null>(null);
  const transition = useRef(1);
  const { camera } = useThree();
  const preset = CAMERA_VIEWS.find((v) => v.id === view) ?? CAMERA_VIEWS[0];
  const desired = useRef(new THREE.Vector3(...preset.position));
  const desiredTarget = useRef(new THREE.Vector3(0, boardY + preset.target[1] + 0.1, 0));

  useEffect(() => {
    desired.current.set(...preset.position);
    desiredTarget.current.set(0, boardY + preset.target[1] * 0.4, 0);
    transition.current = 1;
  }, [view, preset, boardY]);

  useFrame((state, dt) => {
    const c = controls.current;
    if (!c) return;
    if (transition.current > 0.001) {
      const k = 0.14 * transition.current;
      easing.damp3(camera.position, [desired.current.x, desired.current.y + tilt * 2, desired.current.z], k + 0.02, dt);
      easing.damp3(c.target as THREE.Vector3, desiredTarget.current, k + 0.05, dt);
      transition.current = Math.max(0, transition.current - dt * 0.85);
      (c as unknown as { update: (d?: number) => void }).update(dt);
    }
    if (view === 'cinematic' || idle) {
      const angle = state.clock.elapsedTime * (idle ? 0.055 : 0.03);
      const r = Math.hypot(camera.position.x, camera.position.z);
      camera.position.x = THREE.MathUtils.damp(camera.position.x, Math.sin(angle) * r, 1.2, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, Math.cos(angle) * r, 1.2, dt);
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={5.5}
      maxDistance={26}
      minPolarAngle={0.12}
      maxPolarAngle={Math.PI / 2.12}
      rotateSpeed={0.7}
      zoomSpeed={0.8}
    />
  );
}
