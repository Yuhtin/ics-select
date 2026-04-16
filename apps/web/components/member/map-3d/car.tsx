'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Group, Object3D, Vector3, Mesh, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { heightAt } from './terrain';
import { useSceneStore } from './scene-store';
import { getCarModel } from './car-models';
import { useCarPref } from '../../../lib/car-pref';

const MAX_SPEED = 34;
const ACCEL = 62;
const FRICTION = 10;
const WORLD_RADIUS = 140;
const PROXIMITY_RADIUS = 5.5;
const ANGULAR_SPEED = 14;

const WHEEL_NODE_NAMES = ['FrontWheels', 'BackWheels', 'Wheel', 'Wheels', 'Wheel_L', 'Wheel_R'];

interface CarProps {
  positionRef: React.MutableRefObject<Vector3>;
  spawnPosition: Vector3;
  nodePositionsRef: React.MutableRefObject<Map<string, Vector3>>;
}

function CarModelMesh({ url, scale, yOffset }: { url: string; scale: number; yOffset: number }) {
  const gltf = useLoader(GLTFLoader, url);

  const { scene, wheels } = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    const wheelsFound: Object3D[] = [];
    cloned.traverse((obj) => {
      if (WHEEL_NODE_NAMES.includes(obj.name)) wheelsFound.push(obj);
      if ((obj as Mesh).isMesh) {
        const mesh = obj as Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mat = mesh.material as MeshStandardMaterial | MeshStandardMaterial[];
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            if (m && 'flatShading' in m) m.flatShading = true;
          });
        } else if (mat && 'flatShading' in mat) {
          mat.flatShading = true;
        }
      }
    });
    return { scene: cloned, wheels: wheelsFound };
  }, [gltf.scene]);

  const store = useSceneStore;
  useFrame((_, delta) => {
    const keys = store.getState().keys;
    const moving =
      !!(keys['w'] || keys['arrowup'] || keys['s'] || keys['arrowdown'] ||
         keys['a'] || keys['arrowleft'] || keys['d'] || keys['arrowright']);
    if (moving) {
      wheels.forEach((w) => {
        w.rotation.x += delta * 12;
      });
    }
  });

  return <primitive object={scene} scale={scale} position={[0, yOffset, 0]} />;
}

function CarFallback() {
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[2.2, 0.55, 3.2]} />
        <meshStandardMaterial color="#4F46E5" flatShading />
      </mesh>
      <mesh position={[0, 1.1, -0.3]} castShadow>
        <boxGeometry args={[1.75, 0.52, 1.5]} />
        <meshStandardMaterial color="#F97316" flatShading />
      </mesh>
    </group>
  );
}

export function Car({ positionRef, spawnPosition, nodePositionsRef }: CarProps) {
  const groupRef = useRef<Group>(null);
  const state = useRef({ speed: 0, angle: 0 });
  const mode = useSceneStore((s) => s.cameraMode);
  const setNearest = useSceneStore((s) => s.setNearestNode);
  const [carPrefId] = useCarPref();
  const carModel = useMemo(() => getCarModel(carPrefId), [carPrefId]);

  useEffect(() => {
    positionRef.current.copy(spawnPosition);
  }, [positionRef, spawnPosition]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);
    const keys = useSceneStore.getState().keys;

    if (mode === 'follow') {
      let dx = 0;
      let dz = 0;
      if (keys['w'] || keys['arrowup']) dz -= 1;
      if (keys['s'] || keys['arrowdown']) dz += 1;
      if (keys['a'] || keys['arrowleft']) dx -= 1;
      if (keys['d'] || keys['arrowright']) dx += 1;
      const mag = Math.hypot(dx, dz);
      if (mag > 0) {
        dx /= mag;
        dz /= mag;
        state.current.speed = Math.min(MAX_SPEED, state.current.speed + ACCEL * dt);
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - state.current.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        state.current.angle += diff * Math.min(1, dt * ANGULAR_SPEED);
        positionRef.current.x += dx * state.current.speed * dt;
        positionRef.current.z += dz * state.current.speed * dt;
      } else {
        state.current.speed = Math.max(0, state.current.speed - FRICTION * dt);
      }
      positionRef.current.y = heightAt(positionRef.current.x, positionRef.current.z) + 0.5;
      const distFromCenter = Math.hypot(positionRef.current.x, positionRef.current.z);
      if (distFromCenter > WORLD_RADIUS) {
        positionRef.current.x *= WORLD_RADIUS / distFromCenter;
        positionRef.current.z *= WORLD_RADIUS / distFromCenter;
        state.current.speed = 0;
      }
    }

    groupRef.current.position.copy(positionRef.current);
    groupRef.current.rotation.y = state.current.angle;

    const nodes = nodePositionsRef.current;
    let minD = Infinity;
    let minId: string | null = null;
    for (const [id, pos] of nodes) {
      const d = Math.hypot(pos.x - positionRef.current.x, pos.z - positionRef.current.z);
      if (d < minD) {
        minD = d;
        minId = id;
      }
    }
    if (minD < PROXIMITY_RADIUS && minId && mode === 'follow') {
      setNearest(minId);
    } else {
      setNearest(null);
    }
  });

  return (
    <group ref={groupRef}>
      <Suspense fallback={<CarFallback />}>
        <CarModelMesh url={carModel.url} scale={carModel.scale} yOffset={carModel.yOffset} />
      </Suspense>
    </group>
  );
}
