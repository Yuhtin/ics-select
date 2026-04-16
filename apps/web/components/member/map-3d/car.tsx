'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, Vector3 } from 'three';
import { heightAt } from './terrain';
import { useSceneStore } from './scene-store';

const MAX_SPEED = 34;
const ACCEL = 62;
const FRICTION = 10;
const WORLD_RADIUS = 140;
const PROXIMITY_RADIUS = 5.5;
const ANGULAR_SPEED = 14;

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
      {/* Chassi inferior — shell principal */}
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.55, 3.2]} />
        <meshStandardMaterial color="#4F46E5" flatShading metalness={0.5} roughness={0.35} />
      </mesh>

      {/* Corpo superior (hood) — mais estreito, inclinado */}
      <mesh position={[0, 1.0, 0.1]} castShadow>
        <boxGeometry args={[2.0, 0.5, 2.6]} />
        <meshStandardMaterial color="#4F46E5" flatShading metalness={0.5} roughness={0.35} />
      </mesh>

      {/* Cabine (teto) — mais pra trás, coral */}
      <mesh position={[0, 1.45, -0.35]} castShadow>
        <boxGeometry args={[1.75, 0.52, 1.5]} />
        <meshStandardMaterial color="#F97316" flatShading metalness={0.3} roughness={0.4} />
      </mesh>

      {/* Windshield — vidro azul inclinado */}
      <mesh position={[0, 1.35, 0.45]} rotation={[Math.PI * 0.16, 0, 0]} castShadow>
        <boxGeometry args={[1.6, 0.7, 0.08]} />
        <meshStandardMaterial color="#7DD3FC" transparent opacity={0.55} metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Traseira tapered */}
      <mesh position={[0, 1.3, -1.2]} rotation={[-Math.PI * 0.12, 0, 0]} castShadow>
        <boxGeometry args={[1.7, 0.55, 0.1]} />
        <meshStandardMaterial color="#7DD3FC" transparent opacity={0.55} metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Headlights */}
      {([-0.7, 0.7] as const).map((x) => (
        <mesh key={x} position={[x, 0.7, 1.62]} castShadow>
          <boxGeometry args={[0.4, 0.22, 0.12]} />
          <meshStandardMaterial color="#FEF08A" emissive="#FACC15" emissiveIntensity={1.1} />
        </mesh>
      ))}

      {/* Taillights */}
      {([-0.8, 0.8] as const).map((x) => (
        <mesh key={x} position={[x, 0.7, -1.62]}>
          <boxGeometry args={[0.35, 0.18, 0.08]} />
          <meshStandardMaterial color="#F87171" emissive="#EF4444" emissiveIntensity={0.9} />
        </mesh>
      ))}

      {/* Spoiler traseiro */}
      <mesh position={[0, 1.35, -1.8]} castShadow>
        <boxGeometry args={[1.7, 0.12, 0.4]} />
        <meshStandardMaterial color="#1F2937" flatShading />
      </mesh>
      {([-0.75, 0.75] as const).map((x) => (
        <mesh key={x} position={[x, 1.1, -1.82]} castShadow>
          <boxGeometry args={[0.13, 0.4, 0.25]} />
          <meshStandardMaterial color="#1F2937" flatShading />
        </mesh>
      ))}

      {/* Para-choque frontal coral */}
      <mesh position={[0, 0.45, 1.65]}>
        <boxGeometry args={[2.1, 0.3, 0.2]} />
        <meshStandardMaterial color="#F97316" flatShading />
      </mesh>

      {/* Rodas — pneu + aro */}
      {([[-1.12, 0.5, 1.05], [1.12, 0.5, 1.05], [-1.12, 0.5, -1.05], [1.12, 0.5, -1.05]] as const).map(
        ([x, y, z], i) => (
          <group key={i} position={[x, y, z]}>
            <mesh
              ref={(el) => {
                wheelsRef.current[i] = el;
              }}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <cylinderGeometry args={[0.52, 0.52, 0.42, 14]} />
              <meshStandardMaterial color="#0F172A" flatShading roughness={0.9} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.32, 0.32, 0.45, 8]} />
              <meshStandardMaterial color="#94A3B8" flatShading metalness={0.6} roughness={0.3} />
            </mesh>
          </group>
        ),
      )}
    </group>
  );
}
