'use client';

import { useWaitlistStats } from '../../../lib/queries/waitlist';

export function WaitlistStats() {
  const { data, isLoading } = useWaitlistStats();
  if (isLoading || !data) {
    return <p className="font-sans text-xs font-medium text-fg-mute">Loading stats…</p>;
  }
  const distinctCourses = new Set(data.byCourse.filter((c) => c.count > 0).map((c) => c.course)).size;
  const cards = [
    { label: 'Total inscritos',  value: data.total },
    { label: 'Últimos 7 dias',   value: data.last7d },
    { label: 'Cursos distintos', value: distinctCourses },
  ];
  return (
    <div className="grid gap-px overflow-hidden rounded-card bg-border-token border border-border-token sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-surface p-5">
          <p className="font-sans text-xs font-medium text-fg-mute">{c.label}</p>
          <p className="mt-2 font-mono text-3xl tabular-nums text-fg">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
