'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { heightAt } from './terrain';
import { prefersReducedMotion } from '../../../lib/capabilities';

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

interface Placement {
  x: number;
  z: number;
  scale: number;
  rot: number;
  variant: number;
}

function samplePlacements(
  count: number,
  minR: number,
  maxR: number,
  minAvoid: number,
  seed: number,
  scaleMin = 0.6,
  scaleMax = 1.3,
  variants = 1,
): Placement[] {
  const rand = hashRandom(seed);
  const out: Placement[] = [];
  let attempts = 0;
  while (out.length < count && attempts < count * 20) {
    attempts++;
    const a = rand() * Math.PI * 2;
    const r = minR + rand() * (maxR - minR);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (PATH_AVOID.some(([ax, az]) => Math.hypot(ax - x, az - z) < minAvoid)) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 3)) continue;
    out.push({
      x,
      z,
      scale: scaleMin + rand() * (scaleMax - scaleMin),
      rot: rand() * Math.PI * 2,
      variant: Math.floor(rand() * variants),
    });
  }
  return out;
}

function prepareScene(scene: Group): Group {
  const cloned = scene.clone(true);
  cloned.traverse((obj) => {
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
  return cloned;
}

function PropInstance({ source, x, z, scale, rot, yOffset = 0 }: {
  source: Group;
  x: number;
  z: number;
  scale: number;
  rot: number;
  yOffset?: number;
}) {
  const cloned = useMemo(() => prepareScene(source), [source]);
  const y = heightAt(x, z) + yOffset;
  return (
    <primitive object={cloned} position={[x, y, z]} rotation={[0, rot, 0]} scale={scale} />
  );
}

export function Trees() {
  const tree1 = useLoader(GLTFLoader, '/models/props/tree-1.glb');
  const tree2 = useLoader(GLTFLoader, '/models/props/tree-2.glb');

  const placements = useMemo(
    () => samplePlacements(90, 18, 128, 10, 1, 0.9, 1.8, 2),
    [],
  );

  return (
    <>
      {placements.map((p, i) => {
        const source = p.variant === 0 ? tree1.scene : tree2.scene;
        return (
          <PropInstance
            key={i}
            source={source}
            x={p.x}
            z={p.z}
            scale={p.scale * 1.4}
            rot={p.rot}
          />
        );
      })}
    </>
  );
}

export function Rocks() {
  const rock = useLoader(GLTFLoader, '/models/props/rock.glb');
  const rockLarge = useLoader(GLTFLoader, '/models/props/rock-large.glb');

  const placements = useMemo(
    () => samplePlacements(28, 22, 120, 12, 2, 0.5, 1.2, 2),
    [],
  );

  return (
    <>
      {placements.map((p, i) => {
        const source = p.variant === 0 ? rock.scene : rockLarge.scene;
        return (
          <PropInstance
            key={i}
            source={source}
            x={p.x}
            z={p.z}
            scale={p.scale * 1.6}
            rot={p.rot}
          />
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
  const reduced = useMemo(() => prefersReducedMotion(), []);

  useFrame(() => {
    if (reduced) return;
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
