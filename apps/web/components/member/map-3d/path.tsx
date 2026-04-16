'use client';

import { useMemo } from 'react';
import { BufferGeometry, BufferAttribute, CatmullRomCurve3, DoubleSide, Vector3 } from 'three';
import { heightAt } from './terrain';

const PATH_POINTS_TEMPLATE: Array<[number, number]> = [
  [-65,  55], [-35,  45], [-10,  28], [ 20,  12],
  [ 42,  -8], [ 28, -38], [ -5, -52], [-38, -48],
  [-55, -30], [-65,   0], [-60,  30], [-70,  55],
];

export function usePathPoints(count: number): Vector3[] {
  return useMemo(() => {
    const n = Math.max(2, Math.min(count, PATH_POINTS_TEMPLATE.length));
    return PATH_POINTS_TEMPLATE.slice(0, n).map(([x, z]) => {
      const v = new Vector3(x, 0, z);
      v.y = heightAt(x, z) + 0.18;
      return v;
    });
  }, [count]);
}

interface PathProps {
  points: Vector3[];
}

export function Path({ points }: PathProps) {
  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const curve = new CatmullRomCurve3(points, false, 'catmullrom', 0.4);
    const segs = 280;
    const width = 3;
    const verts: number[] = [];
    const uvs: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = curve.getPoint(t);
      p.y = heightAt(p.x, p.z) + 0.14;
      const tg = curve.getTangent(t);
      const n = new Vector3(-tg.z, 0, tg.x).normalize();
      const L = p.clone().addScaledVector(n,  width);
      const R = p.clone().addScaledVector(n, -width);
      verts.push(L.x, L.y, L.z, R.x, R.y, R.z);
      uvs.push(0, t, 1, t);
    }
    const idx: number[] = [];
    for (let i = 0; i < segs; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
    g.setAttribute('uv',       new BufferAttribute(new Float32Array(uvs), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [points]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#FBBF24" roughness={0.7} side={DoubleSide} />
    </mesh>
  );
}
