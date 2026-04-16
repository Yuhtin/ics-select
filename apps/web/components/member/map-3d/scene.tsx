'use client';

import { Suspense, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { Vector3, Color, Fog } from 'three';
import { Terrain } from './terrain';
import { CameraRig } from './camera-rig';
import { Path, usePathPoints } from './path';
import { Nodes } from './nodes';
import type { Plan } from '../../../lib/queries/plan';

interface SceneProps {
  plan: Plan;
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

export function Scene({ plan }: SceneProps) {
  const carPositionRef = useRef(new Vector3(0, 0, 0));
  const nodePositionsRef = useRef(new Map<string, Vector3>());

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
        <PathAndNodes plan={plan} nodePositionsRef={nodePositionsRef} />
      </Suspense>
    </Canvas>
  );
}
