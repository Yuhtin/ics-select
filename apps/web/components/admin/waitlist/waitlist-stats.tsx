'use client';

import { useWaitlistStats } from '../../../lib/queries/waitlist';

export function WaitlistStats() {
  const { data, isLoading } = useWaitlistStats();
  if (isLoading || !data) {
    return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading stats…</p>;
  }
  const distinctCourses = new Set(data.byCourse.filter((c) => c.count > 0).map((c) => c.course)).size;
  const cards = [
    { label: 'Total inscritos',  value: data.total },
    { label: 'Últimos 7 dias',   value: data.last7d },
    { label: 'Cursos distintos', value: distinctCourses },
  ];
  return (
    <div className="grid grid-cols-3 gap-px bg-rule border border-rule">
      {cards.map((c) => (
        <div key={c.label} className="bg-surface p-5">
          <p className="font-mono text-[11px] uppercase tracking-label text-ink-mute">{c.label}</p>
          <p className="mt-2 font-serif-tool text-3xl tabular-nums text-ink">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
