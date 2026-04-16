'use client';

import { useSceneStore } from './scene-store';
import type { Plan } from '../../../lib/queries/plan';

interface HudProps {
  plan: Plan;
}

function formatRange(start: string, end: string): string {
  try {
    const f = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return `${f.format(new Date(start))} — ${f.format(new Date(end))}`;
  } catch {
    return '';
  }
}

export function Hud({ plan }: HudProps) {
  const nearestId = useSceneStore((s) => s.nearestNodeId);
  const mode = useSceneStore((s) => s.cameraMode);
  const done = plan.items.filter((i) => i.status === 'DONE').length;

  return (
    <>
      <div className="fixed top-20 left-6 z-30 bg-white/90 backdrop-blur rounded-xl px-4 py-2 shadow pointer-events-none">
        <div className="text-sm font-bold text-foreground">Mapa de Estudo</div>
        <div className="text-[11px] text-foreground-muted">
          {formatRange(plan.weekStart, plan.weekEnd)} · {done}/{plan.items.length} nodes
        </div>
      </div>

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-white/90 backdrop-blur rounded-full px-4 py-2 shadow pointer-events-none text-[11px] text-foreground-secondary">
        <kbd className="inline-block mx-0.5 px-1.5 py-0.5 rounded border border-stone-300 bg-stone-50 font-bold">W</kbd>
        <kbd className="inline-block mx-0.5 px-1.5 py-0.5 rounded border border-stone-300 bg-stone-50 font-bold">A</kbd>
        <kbd className="inline-block mx-0.5 px-1.5 py-0.5 rounded border border-stone-300 bg-stone-50 font-bold">S</kbd>
        <kbd className="inline-block mx-0.5 px-1.5 py-0.5 rounded border border-stone-300 bg-stone-50 font-bold">D</kbd>
        {' '}dirigir ·{' '}
        <kbd className="inline-block mx-0.5 px-1.5 py-0.5 rounded border border-stone-300 bg-stone-50 font-bold">E</kbd>
        {' '}entrar node ·{' '}
        <kbd className="inline-block mx-0.5 px-1.5 py-0.5 rounded border border-stone-300 bg-stone-50 font-bold">Esc</kbd>
        {' '}sair
      </div>

      {nearestId && mode === 'follow' && (
        <div className="fixed top-[38%] left-1/2 -translate-x-1/2 z-30 bg-brand/95 backdrop-blur rounded-full px-4 py-2.5 text-white font-bold text-sm shadow-lg pointer-events-none">
          Pressione{' '}
          <kbd className="bg-white text-brand px-2 py-0.5 rounded font-bold mx-1">E</kbd>
          {' '}para iniciar
        </div>
      )}
    </>
  );
}
