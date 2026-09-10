/**
 * Worlds. Each location is a full stage: sky/room shell, ground, the table the
 * board stands on, a light rig and a prop cluster that gives the place its
 * character. Everything is procedural geometry + generated textures.
 */
import * as THREE from 'three';
import { memo, useMemo, useRef, type ComponentType } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances, MeshReflectorMaterial, Sparkles } from '@react-three/drei';
import { LOCATIONS, locationOf, type LocationId, type LocationPreset } from '../data/styles';
import { useSettings, type Quality } from '../state/settings';
import { bannerTexture, bookTexture, gridGlowTexture, lavaTexture, marbleTexture, screenTexture, skyTexture, stoneTexture, woodTexture } from './textures';
import { BOARD_OUTER } from './layout';

const groundGeo = new THREE.CircleGeometry(70, 48).rotateX(-Math.PI / 2);
const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const cyl6 = new THREE.CylinderGeometry(0.5, 0.55, 1, 6);
const sphere = new THREE.SphereGeometry(0.5, 18, 14);
const con = new THREE.ConeGeometry(0.5, 1, 14);
const tor = new THREE.TorusGeometry(1, 0.05, 8, 40);
const quad = new THREE.PlaneGeometry(1, 1);

function Sky({ loc }: { loc: LocationPreset }) {
  const tex = useMemo(() => skyTexture(loc.sky[0], loc.sky[1], loc.sky[2], loc.openness > 0.6 ? 0.62 : 0.3), [loc]);
  return (
    <mesh>
      <sphereGeometry args={[120, 32, 20]} />
      {/* tone-mapped like everything else: an untonemapped sky clips to white */}
      <meshBasicMaterial map={tex} side={THREE.BackSide} fog={false} color="#ffffff" />
    </mesh>
  );
}

function Room({ loc }: { loc: LocationPreset }) {
  const wall = useMemo(() => stoneTexture(`wall-${loc.id}`, loc.ground.color, 1.1), [loc]);
  if (loc.openness > 0.6) return null;
  return (
    <group>
      <mesh position={[0, 14, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[26, 26, 30, 24, 1, true]} />
        <meshStandardMaterial map={wall} color={loc.ground.color} side={THREE.BackSide} roughness={0.95} metalness={0.02} />
      </mesh>
      <mesh position={[0, 29, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6, 26, 24]} />
        <meshStandardMaterial color={loc.sky[2]} side={THREE.DoubleSide} roughness={1} />
      </mesh>
    </group>
  );
}

function Ground({ loc, reflect }: { loc: LocationPreset; reflect: boolean }) {
  const map = useMemo(
    () => (loc.id === 'grandHall' || loc.id === 'library' ? woodTexture(`floor-${loc.id}`, loc.ground.color, '#000000', 0.5) : stoneTexture(`floor-${loc.id}`, loc.ground.color, 1)),
    [loc],
  );
  if (reflect) {
    return (
      <mesh geometry={groundGeo} receiveShadow>
        <MeshReflectorMaterial
          resolution={512}
          mixBlur={1.4}
          mixStrength={12 + loc.ground.reflect * 26}
          blur={[420, 140]}
          mirror={loc.ground.reflect}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          roughness={loc.ground.roughness}
          metalness={loc.ground.metalness}
          color={loc.ground.color}
          map={map}
        />
      </mesh>
    );
  }
  return (
    <mesh geometry={groundGeo} receiveShadow>
      <meshStandardMaterial map={map} color={loc.ground.color} roughness={loc.ground.roughness} metalness={loc.ground.metalness} />
    </mesh>
  );
}

function Table({ loc }: { loc: LocationPreset }) {
  const h = loc.table.height;
  const top = 0.14;
  const map = useMemo(
    () =>
      loc.table.roughness > 0.6
        ? woodTexture(`table-${loc.id}`, loc.table.color, '#000000', 0.35)
        : marbleTexture(`table-${loc.id}`, loc.table.color, '#ffffff', 0.6),
    [loc],
  );
  const mat = (
    <meshStandardMaterial map={map} color={loc.table.color} roughness={loc.table.roughness} metalness={loc.table.metalness} />
  );
  const spread = BOARD_OUTER + 1.5;
  return (
    <group>
      {loc.table.shape === 'round' && (
        <>
          <mesh position={[0, h - top / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[spread * 0.62, spread * 0.62, top, 48]} />
            {mat}
          </mesh>
          <mesh position={[0, (h - top) / 2, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.72, h - top, 20]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.05, 0]} receiveShadow>
            <cylinderGeometry args={[spread * 0.42, spread * 0.46, 0.1, 32]} />
            {mat}
          </mesh>
        </>
      )}
      {loc.table.shape === 'square' && (
        <>
          <mesh position={[0, h - top / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[spread * 1.24, top, spread * 1.24]} />
            {mat}
          </mesh>
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([sx, sz], i) => (
            <mesh key={i} position={[sx * spread * 0.5, (h - top) / 2, sz * spread * 0.5]} castShadow>
              <boxGeometry args={[0.3, h - top, 0.3]} />
              {mat}
            </mesh>
          ))}
        </>
      )}
      {loc.table.shape === 'slab' && (
        <mesh position={[0, (h - top) / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[spread * 1.5, h - top / 2, spread * 1.5]} />
          {mat}
        </mesh>
      )}
      {/* soft contact shadow under the board */}
      <mesh position={[0, h + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOARD_OUTER * 2.5, BOARD_OUTER * 2.5]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.32} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Lights({ loc }: { loc: LocationPreset }) {
  const shadows = useSettings((s) => s.shadows);
  const key = useRef<THREE.DirectionalLight>(null);
  useFrame(({ camera }) => {
    if (!key.current) return;
    key.current.position.set(loc.sun.position[0], loc.sun.position[1], loc.sun.position[2]);
    key.current.target.position.set(camera.position.x * 0.05, 0.6, camera.position.z * 0.05);
    key.current.target.updateMatrixWorld();
  });
  const rimPositions: [number, number, number][] = [
    [-7.5, 2.6, -6],
    [7.5, 2.2, 5.5],
  ];
  return (
    <group>
      <hemisphereLight args={[loc.sky[1], loc.ground.color, loc.ambient.intensity * 0.7]} />
      <ambientLight color={loc.ambient.color} intensity={loc.ambient.intensity * 0.5} />
      <directionalLight
        ref={key}
        color={loc.sun.color}
        intensity={loc.sun.intensity}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />
      {loc.rim.map((r, i) => (
        <pointLight
          key={i}
          position={rimPositions[i % rimPositions.length]}
          color={r.color}
          intensity={r.intensity * 12}
          distance={26}
          decay={2}
        />
      ))}
    </group>
  );
}

// --------------------------------------------------------------------- props

function HallProps({ detail }: { detail: number }) {
  const banner = useMemo(() => bannerTexture('#6c1f22', '#d9b463', 3), []);
  const banner2 = useMemo(() => bannerTexture('#1f3560', '#d9b463', 5), []);
  const count = Math.round(8 * detail);
  return (
    <group>
      <Instances geometry={cyl} limit={16}>
        <meshStandardMaterial color="#6a6055" roughness={0.9} map={undefined} />
        {Array.from({ length: count }).map((_, i) => {
          const a = (i / count) * Math.PI * 2 + 0.2;
          return <Instance key={i} position={[Math.cos(a) * 13, 7, Math.sin(a) * 13]} scale={[1.5, 14, 1.5]} />;
        })}
      </Instances>
      <Instances geometry={box} limit={24}>
        <meshStandardMaterial color="#5a5148" roughness={0.95} />
        {Array.from({ length: count }).map((_, i) => {
          const a = (i / count) * Math.PI * 2 + 0.2;
          return <Instance key={i} position={[Math.cos(a) * 13, 14.2, Math.sin(a) * 13]} scale={[2.2, 0.6, 2.2]} />;
        })}
      </Instances>
      {Array.from({ length: Math.round(6 * detail) }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const r = 12.2;
        return (
          <group key={i} position={[Math.cos(a) * r, 8.2, Math.sin(a) * r]} rotation={[0, -a + Math.PI / 2, 0]}>
            <mesh geometry={quad} scale={[2.1, 3.6, 1]} position={[0, 0, 0.02]}>
              <meshStandardMaterial map={i % 2 ? banner : banner2} side={THREE.DoubleSide} roughness={0.85} />
            </mesh>
            <mesh geometry={cyl} rotation={[0, 0, Math.PI / 2]} scale={[0.14, 2.4, 0.14]} position={[0, 1.95, 0]}>
              <meshStandardMaterial color="#3a2c1c" metalness={0.4} roughness={0.6} />
            </mesh>
            {/* torch */}
            <pointLight position={[0, -1.4, 0.7]} color="#ff8a3c" intensity={26} distance={11} decay={2} />
            <mesh geometry={sphere} scale={0.4} position={[0, -1.5, 0.55]}>
              <meshBasicMaterial color="#ffb46a" toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[6.4, 9.6, 48]} />
        <meshStandardMaterial color="#3d342b" roughness={1} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

function GardenProps({ detail }: { detail: number }) {
  const foliage = useMemo(() => new THREE.IcosahedronGeometry(0.5, 1), []);
  const n = Math.round(14 * detail);
  return (
    <group>
      {/* terrace rim */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[17, 17, 0.8, 48, 1, true]} />
        <meshStandardMaterial color="#e8e4da" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.81, 0]}>
        <ringGeometry args={[15.4, 17, 48]} />
        <meshStandardMaterial color="#d9d4c7" roughness={0.9} />
      </mesh>
      <Instances geometry={foliage} limit={64}>
        <meshStandardMaterial color="#3f7d4a" roughness={0.85} flatShading />
        {Array.from({ length: n * 3 }).map((_, i) => {
          const a = (i / (n * 3)) * Math.PI * 2 * 1.7;
          const r = 9.5 + ((i * 7) % 5);
          const s = 1.1 + ((i * 13) % 7) * 0.22;
          return <Instance key={i} position={[Math.cos(a) * r, 1.1 + s * 0.35, Math.sin(a) * r]} scale={[s, s * 0.8, s]} color={i % 3 === 0 ? '#4d9459' : '#356b41'} />;
        })}
      </Instances>
      <Instances geometry={cyl} limit={32}>
        <meshStandardMaterial color="#b9b0a0" roughness={0.7} />
        {Array.from({ length: n }).map((_, i) => {
          const a = (i / n) * Math.PI * 2;
          const r = 9.5 + ((i * 7) % 5);
          return <Instance key={i} position={[Math.cos(a) * r, 0.5, Math.sin(a) * r]} scale={[1.5, 1.2, 1.5]} />;
        })}
      </Instances>
      {/* distant skyline */}
      <Instances geometry={box} limit={40}>
        <meshStandardMaterial color="#9fb3c6" roughness={0.9} transparent opacity={0.42} />
        {Array.from({ length: 30 }).map((_, i) => {
          const a = (i / 30) * Math.PI * 2;
          const r = 48 + ((i * 11) % 14);
          const h = 6 + ((i * 17) % 22);
          return <Instance key={i} position={[Math.cos(a) * r, h / 2, Math.sin(a) * r]} scale={[5 + ((i * 5) % 6), h, 5 + ((i * 3) % 7)]} />;
        })}
      </Instances>
    </group>
  );
}

function ArcadeProps({ detail }: { detail: number }) {
  const strips = useMemo(() => {
    const arr: { pos: [number, number, number]; scale: [number, number, number]; color: string }[] = [];
    const colors = ['#25f4ee', '#ff2bd6', '#7d5cff', '#25f4ee'];
    for (let i = 0; i < Math.round(16 * detail); i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = 13;
      arr.push({
        pos: [Math.cos(a) * r, 3.4 + ((i * 5) % 5) * 1.1, Math.sin(a) * r],
        scale: [0.16, 0.16, 5.4],
        color: colors[i % colors.length],
      });
    }
    return arr;
  }, [detail]);
  return (
    <group>
      <mesh position={[0, 9, 0]}>
        <cylinderGeometry args={[15, 15, 18, 32, 1, true]} />
        <meshStandardMaterial color="#0a0a12" side={THREE.BackSide} roughness={0.5} metalness={0.6} />
      </mesh>
      <Instances geometry={box} limit={40}>
        <meshBasicMaterial toneMapped={false} color="#ffffff" />
        {strips.map((s, i) => (
          <Instance key={i} position={s.pos} scale={s.scale} color={s.color} />
        ))}
      </Instances>
      {Array.from({ length: Math.round(6 * detail) }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        const r = 11.5;
        return (
          <group key={i} position={[Math.cos(a) * r, 4.4, Math.sin(a) * r]} rotation={[0, -a, 0]}>
            <mesh geometry={quad} scale={[3.2, 2, 1]}>
              <meshBasicMaterial map={screenTexture(`s${i}`, ['♞', '♜', '♛', '♟', '♝', '♚'][i % 6], i % 2 ? '#25f4ee' : '#ff2bd6')} toneMapped={false} />
            </mesh>
            <mesh geometry={box} scale={[3.5, 2.3, 0.2]} position={[0, 0, -0.14]}>
              <meshStandardMaterial color="#12121c" roughness={0.4} metalness={0.7} />
            </mesh>
          </group>
        );
      })}
      {Array.from({ length: 4 }).map((_, i) => (
        <mesh key={i} geometry={box} position={[Math.cos(i * 1.9) * 8.5, 0.4, Math.sin(i * 1.9) * 8.5]} scale={[1.6, 1.1, 1.6]}>
          <meshStandardMaterial color="#14141f" roughness={0.35} metalness={0.8} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[64, 64]} />
        <meshBasicMaterial map={gridGlowTexture('#05060d', '#25f4ee', 0.85)} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function MoonProps({ detail }: { detail: number }) {
  const rocks = useMemo(() => new THREE.IcosahedronGeometry(0.5, 0), []);
  return (
    <group>
      <Instances geometry={rocks} limit={64}>
        <meshStandardMaterial color="#8d8b88" roughness={1} flatShading />
        {Array.from({ length: Math.round(30 * detail) }).map((_, i) => {
          const a = (i / 30) * Math.PI * 2 * 2.3;
          const r = 11 + ((i * 13) % 26);
          const s = 0.6 + ((i * 7) % 9) * 0.5;
          return <Instance key={i} position={[Math.cos(a) * r, s * 0.3, Math.sin(a) * r]} scale={[s * 1.6, s, s * 1.3]} rotation={[0, i, 0]} />;
        })}
      </Instances>
      {/* lander */}
      <group position={[-13, 0, 9]} rotation={[0, 0.6, 0]}>
        <mesh geometry={cyl6} scale={[3, 1.6, 3]} position={[0, 2.6, 0]}>
          <meshStandardMaterial color="#d9c07a" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh geometry={con} scale={[4.4, 2.4, 4.4]} position={[0, 1.1, 0]}>
          <meshStandardMaterial color="#b8b2a6" metalness={0.5} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={i} geometry={cyl} scale={[0.12, 2.6, 0.12]} position={[Math.cos(i * 1.57) * 1.8, 1.3, Math.sin(i * 1.57) * 1.8]} rotation={[Math.cos(i * 1.57) * 0.3, 0, -Math.sin(i * 1.57) * 0.3]}>
            <meshStandardMaterial color="#8a8a8a" metalness={0.8} roughness={0.4} />
          </mesh>
        ))}
      </group>
      {/* earth */}
      <group position={[26, 30, -46]}>
        <mesh>
          <sphereGeometry args={[13, 40, 28]} />
          <meshStandardMaterial color="#2b6fb5" roughness={0.7} emissive="#0a2a4a" emissiveIntensity={0.5} />
        </mesh>
        <mesh scale={1.05}>
          <sphereGeometry args={[13, 24, 16]} />
          <meshBasicMaterial color="#7fc4ff" transparent opacity={0.16} side={THREE.BackSide} />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#a5a29c" roughness={1} map={stoneTexture('moonfloor', '#a5a29c', 1.6)} />
      </mesh>
    </group>
  );
}

function ShoreProps({ detail }: { detail: number }) {
  const water = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!water.current) return;
    const t = state.clock.elapsedTime;
    (water.current.material as THREE.MeshStandardMaterial).normalScale?.set(0.6 + Math.sin(t * 0.4) * 0.15, 0.6 + Math.cos(t * 0.3) * 0.15);
  });
  return (
    <group>
      {/* wet sand shelf + sea */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -34]}>
        <planeGeometry args={[160, 70, 1, 1]} />
        <meshStandardMaterial color="#17435f" roughness={0.12} metalness={0.35} />
      </mesh>
      <mesh ref={water} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, -30]}>
        <planeGeometry args={[150, 62, 1, 1]} />
        <meshStandardMaterial color="#2b6a86" roughness={0.06} metalness={0.55} transparent opacity={0.88} />
      </mesh>
      {/* sun disc on the horizon */}
      <mesh position={[-34, 5.2, -60]}>
        <sphereGeometry args={[6, 32, 24]} />
        <meshBasicMaterial color="#ffcf8a" toneMapped={false} />
      </mesh>
      <Instances geometry={cyl} limit={16}>
        <meshStandardMaterial color="#6b4b2a" roughness={0.9} />
        {Array.from({ length: Math.round(6 * detail) }).map((_, i) => {
          const a = (i / 6) * Math.PI * 2 + 0.9;
          const r = 15 + ((i * 5) % 6);
          return <Instance key={i} position={[Math.cos(a) * r, 3, Math.sin(a) * r]} scale={[0.5, 6, 0.5]} rotation={[0.1, 0, i % 2 ? 0.12 : -0.14]} />;
        })}
      </Instances>
      <Instances geometry={con} limit={48}>
        <meshStandardMaterial color="#37734f" roughness={0.8} flatShading />
        {Array.from({ length: Math.round(6 * detail) }).map((_, i) => {
          const a = (i / 6) * Math.PI * 2 + 0.9;
          const r = 15 + ((i * 5) % 6);
          return Array.from({ length: 6 }).map((__, j) => (
            <Instance
              key={`${i}-${j}`}
              position={[Math.cos(a) * r + Math.cos(j) * 1.9, 6.1, Math.sin(a) * r + Math.sin(j) * 1.9]}
              scale={[3.6, 1, 0.6]}
              rotation={[Math.sin(j) * 0.5, (j / 6) * Math.PI * 2, Math.cos(j) * 0.4]}
            />
          ));
        })}
      </Instances>
      <Instances geometry={sphere} limit={24}>
        <meshStandardMaterial color="#c9b291" roughness={0.9} />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2 * 1.4;
          const r = 8 + ((i * 9) % 9);
          const s = 0.4 + ((i * 5) % 4) * 0.3;
          return <Instance key={i} position={[Math.cos(a) * r, s * 0.4, Math.sin(a) * r]} scale={[s * 1.6, s, s * 1.3]} />;
        })}
      </Instances>
    </group>
  );
}

function PalaceProps({ detail }: { detail: number }) {
  const lantern = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (lantern.current) lantern.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.08;
  });
  return (
    <group>
      <Instances geometry={cyl} limit={16}>
        <meshStandardMaterial color="#7d2220" roughness={0.35} metalness={0.15} />
        {Array.from({ length: Math.round(10 * detail) }).map((_, i) => {
          const a = (i / 10) * Math.PI * 2;
          const r = 12;
          return <Instance key={i} position={[Math.cos(a) * r, 5, Math.sin(a) * r]} scale={[1.1, 10, 1.1]} />;
        })}
      </Instances>
      {/* tiled roof ring */}
      <mesh position={[0, 10.6, 0]}>
        <coneGeometry args={[15, 3.2, 12, 1, true]} />
        <meshStandardMaterial color="#2c3b46" roughness={0.6} side={THREE.DoubleSide} metalness={0.2} />
      </mesh>
      <group ref={lantern}>
        {Array.from({ length: Math.round(8 * detail) }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2 + 0.3;
          const r = 9.5;
          return (
            <group key={i} position={[Math.cos(a) * r, 7.4, Math.sin(a) * r]}>
              <mesh geometry={sphere} scale={[0.62, 0.8, 0.62]}>
                <meshStandardMaterial color="#ff9a4a" emissive="#ff6a2b" emissiveIntensity={2.4} toneMapped={false} />
              </mesh>
              <mesh geometry={cyl} scale={[0.7, 0.1, 0.7]} position={[0, 0.66, 0]}>
                <meshStandardMaterial color="#3a2415" roughness={0.6} />
              </mesh>
              <pointLight color="#ff9a4a" intensity={14} distance={9} decay={2} />
            </group>
          );
        })}
      </group>
      {/* moon gate */}
      <mesh position={[0, 3.2, -14]} rotation={[0, 0, 0]}>
        <torusGeometry args={[3.4, 0.32, 10, 40]} />
        <meshStandardMaterial color="#e8e2d2" roughness={0.7} />
      </mesh>
      <Instances geometry={cyl6} limit={40}>
        <meshStandardMaterial color="#4d7a3f" roughness={0.8} />
        {Array.from({ length: Math.round(24 * detail) }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2 * 1.6;
          const r = 13.5 + ((i * 5) % 4);
          const h = 3 + ((i * 7) % 5);
          return <Instance key={i} position={[Math.cos(a) * r, h / 2, Math.sin(a) * r]} scale={[0.22, h, 0.22]} />;
        })}
      </Instances>
    </group>
  );
}

function ForgeProps({ detail }: { detail: number }) {
  const lava = useMemo(() => lavaTexture('forge', '#ff5a1f', 1), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial map={lava} emissiveMap={lava} emissive="#ff5a1f" emissiveIntensity={1.4} roughness={0.85} metalness={0.2} />
      </mesh>
      <Instances geometry={cyl6} limit={48}>
        <meshStandardMaterial color="#191521" roughness={0.85} metalness={0.25} flatShading />
        {Array.from({ length: Math.round(22 * detail) }).map((_, i) => {
          const a = (i / 22) * Math.PI * 2 * 1.3;
          const r = 10 + ((i * 11) % 12);
          const h = 2.4 + ((i * 7) % 8);
          return <Instance key={i} position={[Math.cos(a) * r, h / 2, Math.sin(a) * r]} scale={[1.5 + ((i * 3) % 3) * 0.4, h, 1.5]} />;
        })}
      </Instances>
      <Instances geometry={con} limit={32}>
        <meshStandardMaterial color="#241d24" roughness={0.7} metalness={0.4} flatShading />
        {Array.from({ length: Math.round(12 * detail) }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2 + 0.7;
          const r = 8 + ((i * 5) % 6);
          return <Instance key={i} position={[Math.cos(a) * r, 0.4, Math.sin(a) * r]} scale={[2.2, 1.6, 2.2]} rotation={[0, i, 0]} />;
        })}
      </Instances>
      {Array.from({ length: 3 }).map((_, i) => (
        <pointLight key={i} position={[Math.cos(i * 2.1) * 7, 0.6, Math.sin(i * 2.1) * 7]} color="#ff5a1f" intensity={30} distance={14} decay={2} />
      ))}
    </group>
  );
}

function LibraryProps({ detail }: { detail: number }) {
  const books = useMemo(() => bookTexture(4), []);
  const n = Math.round(10 * detail);
  return (
    <group>
      <Instances geometry={box} limit={32}>
        <meshStandardMaterial map={books} roughness={0.75} />
        {Array.from({ length: n }).map((_, i) => {
          const a = (i / n) * Math.PI * 2;
          const r = 12.5;
          return (
            <Instance
              key={i}
              position={[Math.cos(a) * r, 4.2, Math.sin(a) * r]}
              rotation={[0, -a, 0]}
              scale={[6.4, 8.4, 0.9]}
            />
          );
        })}
      </Instances>
      <Instances geometry={box} limit={16}>
        <meshStandardMaterial color="#3a2415" roughness={0.6} metalness={0.05} />
        {Array.from({ length: n }).map((_, i) => {
          const a = (i / n) * Math.PI * 2;
          const r = 12.5;
          return <Instance key={i} position={[Math.cos(a) * r, 0.35, Math.sin(a) * r]} rotation={[0, -a, 0]} scale={[6.6, 0.7, 1.2]} />;
        })}
      </Instances>
      {/* reading lamps */}
      {Array.from({ length: 3 }).map((_, i) => {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        return (
          <group key={i} position={[Math.cos(a) * 8.2, 0, Math.sin(a) * 8.2]}>
            <mesh geometry={cyl} scale={[0.09, 4.4, 0.09]} position={[0, 2.2, 0]}>
              <meshStandardMaterial color="#22201c" metalness={0.8} roughness={0.35} />
            </mesh>
            <mesh geometry={con} scale={[1.1, 0.8, 1.1]} position={[0, 4.5, 0]} rotation={[Math.PI, 0, 0]}>
              <meshStandardMaterial color="#c9a86a" metalness={0.6} roughness={0.35} side={THREE.DoubleSide} />
            </mesh>
            <pointLight position={[0, 4.1, 0]} color="#ffd9a0" intensity={22} distance={11} decay={2} />
          </group>
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[11, 8]} />
        <meshStandardMaterial color="#5b2b26" roughness={1} map={woodTexture('rug', '#5b2b26', '#2a1210', 0.7)} />
      </mesh>
    </group>
  );
}

const PROPS: Record<LocationId, ComponentType<{ detail: number }>> = {
  grandHall: HallProps,
  skyGarden: GardenProps,
  neonArcade: ArcadeProps,
  moonDeck: MoonProps,
  sunsetShore: ShoreProps,
  jadePalace: PalaceProps,
  obsidianForge: ForgeProps,
  library: LibraryProps,
};

export const World = memo(function World({ locationId }: { locationId: LocationId }) {
  const loc = locationOf(locationId);
  const quality = useSettings((s) => s.quality) as Quality;
  const reflections = useSettings((s) => s.reflections);
  const detail = quality === 'low' ? 0.45 : quality === 'medium' ? 0.7 : 1;
  const reflectFloor = reflections && (quality === 'high' || quality === 'ultra') && loc.ground.reflect > 0.12;
  const Props = PROPS[locationId] ?? HallProps;

  return (
    <group>
      <Sky loc={loc} />
      <Room loc={loc} />
      <Ground loc={loc} reflect={!!reflectFloor} />
      <Table loc={loc} />
      <Lights loc={loc} />
      <Props detail={detail} />
      {loc.particles && (
        <Sparkles
          count={Math.round(loc.particles.count * detail)}
          scale={[26, 9, 26]}
          position={[0, 4, 0]}
          size={loc.particles.size * 46}
          speed={loc.particles.speed}
          color={loc.particles.color}
          opacity={0.55}
          noise={0.6}
        />
      )}
      {/* subtle uplight so pieces never become silhouettes */}
      <pointLight position={[0, loc.table.height + 0.5, 0]} intensity={5} distance={7} decay={2} color={loc.rim[0]?.color ?? '#ffffff'} />
      <mesh geometry={tor} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[BOARD_OUTER + 1.1, BOARD_OUTER + 1.1, 1]}>
        <meshBasicMaterial color={loc.rim[0]?.color ?? '#ffffff'} transparent opacity={0.14} toneMapped={false} />
      </mesh>
    </group>
  );
});

export { skyTexture };
