'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, Vector3 } from 'three';
import { heightAt } from './terrain';
import { useSceneStore } from './scene-store';

const MAX_SPEED = 24;
const ACCEL = 44;
const FRICTION = 14;
const WORLD_RADIUS = 140;
const PROXIMITY_RADIUS = 5;

interface CarProps {
  positionRef: React.MutableRefObject<Vector3>;
  spawnPosition: Vector3;
  nodePositionsRef: React.MutableRefObject<Map<string, Vector3>>;
}

export function Car({ positionRef, spawnPosition, nodePositionsRef }: CarProps) {
  const groupRef = useRef<Group>(null);
  const wheelsRef = useRef<Array<Mesh | null>>([]);
  const state = useRef({ speed: 0, angle: 0 });
  const mode = useSceneStore((s) => s.cameraMode);
  const setNearest = useSceneStore((s) => s.setNearestNode);

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
        state.current.angle += diff * Math.min(1, dt * 8);
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
    wheelsRef.current.forEach((w) => {
      if (w) w.rotation.x += state.current.speed * dt * 2;
    });

    // Proximity: nearest node within 5 units (x/z plane)
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
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[2, 0.7, 3]} />
        <meshStandardMaterial color="#4F46E5" flatShading metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.5, -0.2]} castShadow>
        <boxGeometry args={[1.6, 0.7, 1.5]} />
        <meshStandardMaterial color="#F97316" flatShading />
      </mesh>
      <mesh position={[0, 0.9, 1.7]}>
        <boxGeometry args={[1.4, 0.4, 0.5]} />
        <meshStandardMaterial color="#F97316" flatShading />
      </mesh>
      {([[-1.1, 0.5, 1], [1.1, 0.5, 1], [-1.1, 0.5, -1], [1.1, 0.5, -1]] as const).map(
        ([x, y, z], i) => (
          <mesh
            key={i}
            ref={(el) => {
              wheelsRef.current[i] = el;
            }}
            position={[x, y, z]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.5, 0.5, 0.4, 10]} />
            <meshStandardMaterial color="#1F2937" flatShading />
          </mesh>
        ),
      )}
    </group>
  );
}
