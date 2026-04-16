'use client';

import { useEffect, useState } from 'react';
import { shouldUse3DMap } from '../../lib/capabilities';
import { NodeMap } from './map-2d/node-map';
import type { Plan } from '../../lib/queries/plan';

interface MapViewportProps {
  plan: Plan;
}

export function MapViewport({ plan }: MapViewportProps) {
  const [use3D, setUse3D] = useState(false);

  useEffect(() => {
    setUse3D(shouldUse3DMap());
    const onResize = () => setUse3D(shouldUse3DMap());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Fase 1: 3D ainda não existe — sempre cai no 2D. Será plugado em Fase 2.
  if (use3D) {
    return <NodeMap planId={plan.id} items={plan.items} />;
  }
  return <NodeMap planId={plan.id} items={plan.items} />;
}
