'use client';

import { useMemo } from 'react';
import { PlaneGeometry } from 'three';

export function heightAt(x: number, z: number): number {
  const d = Math.sqrt(x * x + z * z);
  const base = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 1.8;
  const ridge = Math.sin((x + z) * 0.04) * 0.7;
  const rim = d > 80 ? (d - 80) * 0.18 : 0;
  return base + ridge + rim;
}

export function Terrain() {
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(400, 400, 120, 120);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, heightAt(pos.getX(i), pos.getY(i)));
    }
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial color="#6EE7B7" flatShading roughness={0.95} />
    </mesh>
  );
}
