'use client';

import { useEffect, useMemo, useState } from 'react';
import { Scene } from './scene';
import { Hud } from './hud';
import { FocusCard } from './focus-card';
import { useSceneStore } from './scene-store';
import { NodeMap } from '../map-2d/node-map';
import type { Plan } from '../../../lib/queries/plan';

interface Map3DProps {
  plan: Plan;
}

export default function Map3D({ plan }: Map3DProps) {
  const [glError, setGlError] = useState(false);
  const reset = useSceneStore((s) => s.reset);
  const focusedId = useSceneStore((s) => s.focusedNodeId);
  const setMode = useSceneStore((s) => s.setMode);
  const setFocusedNode = useSceneStore((s) => s.setFocusedNode);

  useEffect(() => {
    return () => reset();
  }, [reset]);

  useEffect(() => {
    const onLost = () => setGlError(true);
    const canvas = document.querySelector('canvas');
    canvas?.addEventListener('webglcontextlost', onLost);
    return () => canvas?.removeEventListener('webglcontextlost', onLost);
  }, []);

  useEffect(() => {
    if (glError) return;
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
  }, [glError, setMode, setFocusedNode]);

  const focusedItem = useMemo(
    () => plan.items.find((i) => i.id === focusedId) ?? null,
    [plan.items, focusedId],
  );

  if (glError) {
    return (
      <div>
        <div className="bg-amber-50 text-amber-900 text-sm p-3 rounded-lg mb-3 border border-amber-200">
          Algo deu errado com o WebGL — voltando para o mapa simples.
        </div>
        <NodeMap planId={plan.id} items={plan.items} />
      </div>
    );
  }

  const orderedItems = useMemo(
    () => [...plan.items].sort((a, b) => a.order - b.order),
    [plan.items],
  );

  return (
    <div className="fixed inset-0 z-0 bg-[#FEE9D2]">
      <Scene
        plan={plan}
        onFpsFallback={() => {
          localStorage.setItem('ics:map3d', 'off');
          window.location.reload();
        }}
      />
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
      <ul
        className="sr-only"
        aria-label="Lista de nodes do plano (alternativa acessível ao mapa 3D)"
      >
        {orderedItems.map((item, i) => (
          <li key={item.id}>
            Node {i + 1}: {item.libraryItem.title} —{' '}
            {item.status === 'DONE' ? 'concluído' : 'pendente'}
            {item.libraryItem.url && (
              <>
                {' '}
                <a href={item.libraryItem.url} target="_blank" rel="noopener noreferrer">
                  (abrir material)
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
