'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, CircleGeometry, ExtrudeGeometry, Shape, SpriteMaterial, Vector3, Group, Mesh, MeshBasicMaterial } from 'three';
import { prefersReducedMotion } from '../../../lib/capabilities';

export type NodeVisualStatus = 'done' | 'active' | 'pending';

const R = 2.2;

const COLORS: Record<NodeVisualStatus, { body: string; edge: string; emi: string; ei: number }> = {
  done:    { body: '#10B981', edge: '#065F46', emi: '#065F46', ei: 0.15 },
  active:  { body: '#6366F1', edge: '#3730A3', emi: '#4F46E5', ei: 0.55 },
  pending: { body: '#D6D3D1', edge: '#78716C', emi: '#000000', ei: 0 },
};

function buildHexShape(): Shape {
  const s = new Shape();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 - Math.PI / 2;
    const x = Math.cos(a) * R;
    const y = Math.sin(a) * R;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function buildLabelTexture(status: NodeVisualStatus, number: number): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext('2d');
  if (!ctx) return new CanvasTexture(cv);
  ctx.fillStyle = status === 'pending' ? '#57534E' : 'white';
  ctx.font = 'bold 84px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (status === 'done') {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(36, 66);
    ctx.lineTo(58, 90);
    ctx.lineTo(94, 40);
    ctx.stroke();
  } else {
    ctx.fillText(String(number), 64, 70);
  }
  const t = new CanvasTexture(cv);
  t.anisotropy = 4;
  return t;
}

interface NodeMeshProps {
  position: Vector3;
  status: NodeVisualStatus;
  number: number;
  isNearest: boolean;
}

export function NodeMesh({ position, status, number, isNearest }: NodeMeshProps) {
  const groupRef = useRef<Group>(null);
  const glowRef = useRef<Mesh>(null);
  const baseY = position.y + 1.2;

  const hexShape = useMemo(() => buildHexShape(), []);
  const bodyGeo = useMemo(() => {
    const g = new ExtrudeGeometry(hexShape, {
      depth: 1.4, bevelEnabled: true, bevelSize: 0.22, bevelThickness: 0.22, bevelSegments: 2,
    });
    g.translate(0, 0, -0.7);
    return g;
  }, [hexShape]);
  const ringGeo = useMemo(
    () => new ExtrudeGeometry(hexShape, { depth: 0.5, bevelEnabled: false }),
    [hexShape],
  );
  const glowGeo = useMemo(() => new CircleGeometry(5, 32), []);

  const labelMaterial = useMemo(() => {
    const tex = buildLabelTexture(status, number);
    return new SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  }, [status, number]);

  const c = COLORS[status];
  const reduced = useMemo(() => prefersReducedMotion(), []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const t = performance.now() * 0.001;
    if (reduced) {
      // Subtle pulse only on active; others static
      if (status === 'active') {
        groupRef.current.position.y = baseY + Math.sin(t * 2) * 0.1;
      }
    } else if (status === 'active') {
      groupRef.current.position.y = baseY + Math.sin(t * 2) * 0.25;
      if (glowRef.current) {
        const s = 1 + Math.sin(t * 2.5) * 0.15;
        glowRef.current.scale.setScalar(s);
        const mat = glowRef.current.material as MeshBasicMaterial;
        mat.opacity = 0.22 + Math.abs(Math.sin(t * 2.5)) * 0.18;
      }
    } else if (status === 'done') {
      groupRef.current.rotation.y = Math.sin(t * 0.4 + number) * 0.04;
    }
    const scaleTarget = isNearest ? 1.15 : 1;
    const current = groupRef.current.scale.x;
    groupRef.current.scale.setScalar(current + (scaleTarget - current) * Math.min(1, delta * 10));
  });

  return (
    <group ref={groupRef} position={[position.x, baseY, position.z]}>
      <mesh geometry={bodyGeo} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <meshStandardMaterial
          color={c.body}
          emissive={c.emi}
          emissiveIntensity={c.ei}
          metalness={0.3}
          roughness={0.4}
          flatShading
        />
      </mesh>
      <mesh
        geometry={ringGeo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.35, 0]}
        scale={[1.12, 1.12, 1]}
        castShadow
      >
        <meshStandardMaterial color={c.edge} flatShading />
      </mesh>
      <sprite material={labelMaterial} scale={[2.8, 2.8, 1]} position={[0, 1, 0]} />
      {status === 'active' && (
        <mesh ref={glowRef} geometry={glowGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.65, 0]}>
          <meshBasicMaterial color="#6366F1" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
