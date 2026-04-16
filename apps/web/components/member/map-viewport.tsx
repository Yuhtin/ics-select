'use client';

import { Suspense, lazy, useEffect, useState } from 'react';
import { shouldUse3DMap } from '../../lib/capabilities';
import { NodeMap } from './map-2d/node-map';
import type { Plan } from '../../lib/queries/plan';

const Map3D = lazy(() => import('./map-3d'));

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

  if (use3D) {
    return (
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[60vh] text-sm text-foreground-muted">
            Carregando mundo 3D…
          </div>
        }
      >
        <Map3D plan={plan} />
      </Suspense>
    );
  }
  return <NodeMap planId={plan.id} items={plan.items} />;
}
