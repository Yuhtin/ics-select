'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { heightAt } from './terrain';

const CRYSTAL_COLORS = ['#8B5CF6', '#F97316', '#FBBF24', '#EC4899', '#4F46E5'];

const PATH_AVOID: Array<[number, number]> = [
  [-65,  55], [-35,  45], [-10,  28], [ 20,  12],
  [ 42,  -8], [ 28, -38], [ -5, -52], [-38, -48],
  [-55, -30], [-65,   0], [-60,  30], [-70,  55],
];

function hashRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function samplePositions(
  count: number,
  minR: number,
  maxR: number,
  avoid: Array<[number, number]>,
  minAvoid: number,
  seed: number,
): Array<{ x: number; z: number; s: number }> {
  const rand = hashRandom(seed);
  const out: Array<{ x: number; z: number; s: number }> = [];
  let attempts = 0;
  while (out.length < count && attempts < count * 20) {
    attempts++;
    const a = rand() * Math.PI * 2;
    const r = minR + rand() * (maxR - minR);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const tooClose = avoid.some(([ax, az]) => Math.hypot(ax - x, az - z) < minAvoid);
    if (tooClose) continue;
    out.push({ x, z, s: 0.6 + rand() * 0.8 });
  }
  return out;
}

export function Trees() {
  const positions = useMemo(() => samplePositions(140, 18, 128, PATH_AVOID, 8, 1), []);
  return (
    <group>
      {positions.map((p, i) => {
        const y = heightAt(p.x, p.z);
        return (
          <group key={i} position={[p.x, y, p.z]} scale={[p.s, p.s, p.s]}>
            <mesh position={[0, 0.9, 0]} castShadow>
              <cylinderGeometry args={[0.35, 0.45, 1.8, 6]} />
              <meshStandardMaterial color="#78350F" flatShading />
            </mesh>
            <mesh position={[0, 3.1, 0]} castShadow>
              <coneGeometry args={[1.7, 3.4, 6]} />
              <meshStandardMaterial color="#065F46" flatShading />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

const MOUNTAIN_SPEC: Array<{ x: number; z: number; h: number; c: string }> = [
  { x: -120, z: -70, h: 32, c: '#F97316' },
  { x:  110, z: -90, h: 38, c: '#EA580C' },
  { x: -130, z:  40, h: 28, c: '#FB923C' },
  { x:  125, z:  60, h: 30, c: '#F97316' },
  { x:   80, z: -10, h: 22, c: '#FB923C' },
  { x:  -90, z:  90, h: 26, c: '#EA580C' },
];

export function Mountains() {
  return (
    <>
      {MOUNTAIN_SPEC.map((m, i) => (
        <mesh key={i} position={[m.x, heightAt(m.x, m.z) + m.h / 2, m.z]} castShadow>
          <coneGeometry args={[m.h * 0.7, m.h, 5]} />
          <meshStandardMaterial color={m.c} flatShading />
        </mesh>
      ))}
    </>
  );
}

export function Crystals() {
  const positions = useMemo(() => samplePositions(18, 20, 105, PATH_AVOID, 6, 2), []);
  const refs = useRef<Array<{ mesh: Group | null; phase: number; baseY: number }>>([]);

  useFrame(() => {
    const t = performance.now() * 0.001;
    refs.current.forEach((r, i) => {
      if (!r || !r.mesh) return;
      r.mesh.position.y = r.baseY + Math.sin(t * 1.2 + r.phase) * 0.3;
      r.mesh.rotation.y = t * 0.5 + i;
    });
  });

  return (
    <>
      {positions.map((p, i) => {
        const baseY = heightAt(p.x, p.z) + 2.2;
        const color = CRYSTAL_COLORS[i % CRYSTAL_COLORS.length];
        const phase = (i * 0.7) % (Math.PI * 2);
        return (
          <group
            key={i}
            position={[p.x, baseY, p.z]}
            ref={(el) => {
              refs.current[i] = { mesh: el, phase, baseY };
            }}
          >
            <mesh castShadow>
              <octahedronGeometry args={[1.1]} />
              <meshStandardMaterial
                color={color}
                flatShading
                metalness={0.3}
                roughness={0.3}
                emissive={color}
                emissiveIntensity={0.35}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

export function Clouds() {
  const clouds = useMemo(() => {
    const rand = hashRandom(7);
    return Array.from({ length: 6 }, (_, i) => {
      const parts = Array.from({ length: 5 }, (_, j) => ({
        dx: j * 1.8 - 3,
        dy: rand() * 0.6,
        dz: rand() * 0.6,
        r: 2 + rand(),
      }));
      return {
        x: -80 + i * 32,
        y: 34 + rand() * 4,
        z: -60 + rand() * 120,
        parts,
        speed: 0.9 * (i + 1),
      };
    });
  }, []);
  const groupRefs = useRef<Array<Group | null>>([]);

  useFrame(() => {
    const t = performance.now() * 0.001;
    groupRefs.current.forEach((g, i) => {
      if (!g) return;
      const cloud = clouds[i];
      if (!cloud) return;
      let nextX = cloud.x + (t * cloud.speed) % 280;
      if (nextX > 140) nextX -= 280;
      g.position.x = nextX;
    });
  });

  return (
    <>
      {clouds.map((c, i) => (
        <group
          key={i}
          position={[c.x, c.y, c.z]}
          ref={(el) => {
            groupRefs.current[i] = el;
          }}
        >
          {c.parts.map((part, j) => (
            <mesh key={j} position={[part.dx, part.dy, part.dz]}>
              <sphereGeometry args={[part.r, 8, 8]} />
              <meshStandardMaterial color="white" flatShading roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

export function Sun() {
  return (
    <mesh position={[80, 75, -70]}>
      <sphereGeometry args={[6, 24, 24]} />
      <meshBasicMaterial color="#FEF3C7" />
    </mesh>
  );
}
