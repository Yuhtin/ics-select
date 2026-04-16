'use client';

import { useMemo, useEffect } from 'react';
import { Vector3 } from 'three';
import { NodeMesh, type NodeVisualStatus } from './node-mesh';
import { usePathPoints } from './path';
import { useSceneStore } from './scene-store';
import type { PlanItem } from '../../../lib/queries/plan';

function statusOf(item: PlanItem, index: number, items: PlanItem[]): NodeVisualStatus {
  if (item.status === 'DONE') return 'done';
  const firstPending = items.findIndex((i) => i.status === 'PENDING');
  if (firstPending === index) return 'active';
  return 'pending';
}

interface NodesProps {
  items: PlanItem[];
  onPositions?: (map: Map<string, Vector3>) => void;
}

export function Nodes({ items, onPositions }: NodesProps) {
  const ordered = useMemo(() => [...items].sort((a, b) => a.order - b.order), [items]);
  const points = usePathPoints(ordered.length);
  const nearestId = useSceneStore((s) => s.nearestNodeId);

  const positions = useMemo(() => {
    const map = new Map<string, Vector3>();
    ordered.forEach((it, i) => {
      if (points[i]) map.set(it.id, points[i].clone().setY(points[i].y + 1.2));
    });
    return map;
  }, [ordered, points]);

  useEffect(() => {
    onPositions?.(positions);
  }, [positions, onPositions]);

  return (
    <>
      {ordered.map((item, i) => {
        const p = points[i];
        if (!p) return null;
        return (
          <NodeMesh
            key={item.id}
            position={p}
            status={statusOf(item, i, ordered)}
            number={i + 1}
            isNearest={item.id === nearestId}
          />
        );
      })}
    </>
  );
}
