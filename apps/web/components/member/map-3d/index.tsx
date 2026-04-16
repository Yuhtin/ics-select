'use client';

import { useEffect } from 'react';
import { Scene } from './scene';
import { useSceneStore } from './scene-store';
import type { Plan } from '../../../lib/queries/plan';

interface Map3DProps {
  plan: Plan;
}

export default function Map3D({ plan }: Map3DProps) {
  const reset = useSceneStore((s) => s.reset);

  useEffect(() => {
    return () => reset();
  }, [reset]);

  return (
    <div className="fixed inset-0 z-0 bg-[#FEE9D2]">
      <Scene plan={plan} />
    </div>
  );
}
