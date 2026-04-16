'use client';

import { Suspense, useCallback, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { Vector3, Color, Fog } from 'three';
import { Terrain, heightAt } from './terrain';
import { CameraRig } from './camera-rig';
import { Path, usePathPoints } from './path';
import { Nodes } from './nodes';
import { Car } from './car';
import { useKeyboard } from './input';
import { Trees, Mountains, Crystals, Clouds, Sun } from './props';
import { FpsMonitor } from './fps-monitor';
import type { Plan } from '../../../lib/queries/plan';

interface SceneProps {
  plan: Plan;
  onFpsFallback?: () => void;
}

const PATH_POINTS_FALLBACK: Array<[number, number]> = [
  [-65,  55], [-35,  45], [-10,  28], [ 20,  12],
  [ 42,  -8], [ 28, -38], [ -5, -52], [-38, -48],
  [-55, -30], [-65,   0], [-60,  30], [-70,  55],
];

function computeSpawn(plan: Plan): Vector3 {
  const firstPending = plan.items.findIndex((i) => i.status === 'PENDING');
  const idx = firstPending >= 0 ? firstPending : 0;
  const [x, z] = PATH_POINTS_FALLBACK[idx] ?? PATH_POINTS_FALLBACK[0];
  const sx = x + 4;
  const sz = z + 4;
  return new Vector3(sx, heightAt(sx, sz) + 0.5, sz);
}

function PathAndNodes({
  plan,
  nodePositionsRef,
}: {
  plan: Plan;
  nodePositionsRef: React.MutableRefObject<Map<string, Vector3>>;
}) {
  const points = usePathPoints(plan.items.length);
  const handlePositions = useCallback(
    (m: Map<string, Vector3>) => {
      nodePositionsRef.current = m;
    },
    [nodePositionsRef],
  );
  return (
    <>
      <Path points={points} />
      <Nodes items={plan.items} onPositions={handlePositions} />
    </>
  );
}

export function Scene({ plan, onFpsFallback }: SceneProps) {
  useKeyboard();
  const carPositionRef = useRef(new Vector3(0, 0, 0));
  const nodePositionsRef = useRef(new Map<string, Vector3>());
  const spawn = useMemo(() => computeSpawn(plan), [plan]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
      aria-label="Mapa 3D de estudo — use WASD para mover o carrinho, E para entrar em um node"
      onCreated={({ scene }) => {
        scene.background = new Color('#FEE9D2');
        scene.fog = new Fog('#FDBA74', 100, 220);
      }}
    >
      <OrthographicCamera makeDefault position={[0, 70, 55]} near={0.1} far={400} />
      <CameraRig carPositionRef={carPositionRef} nodePositionsRef={nodePositionsRef} />
      {onFpsFallback && <FpsMonitor onFallback={onFpsFallback} />}

      <directionalLight
        position={[60, 90, 30]}
        intensity={1.35}
        color="#FFE4B5"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-140}
        shadow-camera-right={140}
        shadow-camera-top={140}
        shadow-camera-bottom={-140}
        shadow-camera-far={250}
        shadow-bias={-0.0003}
      />
      <ambientLight color="#FFF5E6" intensity={0.55} />
      <hemisphereLight args={['#FDBA74', '#34D399', 0.45]} />

      <Suspense fallback={null}>
        <Terrain />
        <Trees />
        <Mountains />
        <Crystals />
        <Clouds />
        <Sun />
        <PathAndNodes plan={plan} nodePositionsRef={nodePositionsRef} />
        <Car
          positionRef={carPositionRef}
          spawnPosition={spawn}
          nodePositionsRef={nodePositionsRef}
        />
      </Suspense>
    </Canvas>
  );
}
