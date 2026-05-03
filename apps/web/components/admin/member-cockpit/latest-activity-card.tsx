import type { CockpitResponse } from '../../../lib/queries/admin-cockpit';

function rel(occurredAt: string): string {
  const days = Math.floor((Date.now() - new Date(occurredAt).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1d';
  return `${days}d`;
}

export function LatestActivityCard({ events }: { events: CockpitResponse['recentActivity'] }) {
  return (
    <section className="bg-surface border border-rule rounded-lg p-6">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
          Latest activity
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
          last 30 days
        </span>
      </div>
      <ol className="mt-3 space-y-2.5">
        {events.length === 0 && (
          <li className="font-mono text-[11px] text-ink-faint">No activity recorded yet.</li>
        )}
        {events.map((e, i) => (
          <li key={i} className="flex items-baseline gap-3 font-mono text-[11px]">
            <span className="text-ink-faint tabular-nums shrink-0 w-12">{rel(e.occurredAt)}</span>
            <span className="w-1 h-1 rounded-full bg-ink-mute shrink-0" />
            <span className="text-ink-soft truncate">{e.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
