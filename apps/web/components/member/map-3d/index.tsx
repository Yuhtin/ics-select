'use client';

import { useEffect, useMemo } from 'react';
import { Scene } from './scene';
import { Hud } from './hud';
import { FocusCard } from './focus-card';
import { useSceneStore } from './scene-store';
import type { Plan } from '../../../lib/queries/plan';

interface Map3DProps {
  plan: Plan;
}

export default function Map3D({ plan }: Map3DProps) {
  const reset = useSceneStore((s) => s.reset);
  const focusedId = useSceneStore((s) => s.focusedNodeId);
  const setMode = useSceneStore((s) => s.setMode);
  const setFocusedNode = useSceneStore((s) => s.setFocusedNode);

  useEffect(() => {
    return () => reset();
  }, [reset]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const store = useSceneStore.getState();
      if (k === 'e' && store.nearestNodeId && store.cameraMode === 'follow') {
        setFocusedNode(store.nearestNodeId);
        setMode('focus');
      } else if (k === 'escape' && store.cameraMode === 'focus') {
        setFocusedNode(null);
        setMode('follow');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMode, setFocusedNode]);

  const focusedItem = useMemo(
    () => plan.items.find((i) => i.id === focusedId) ?? null,
    [plan.items, focusedId],
  );

  return (
    <div className="fixed inset-0 z-0 bg-[#FEE9D2]">
      <Scene plan={plan} />
      <Hud plan={plan} />
      {focusedItem && (
        <FocusCard
          planId={plan.id}
          item={focusedItem}
          onClose={() => {
            setFocusedNode(null);
            setMode('follow');
          }}
        />
      )}
    </div>
  );
}
