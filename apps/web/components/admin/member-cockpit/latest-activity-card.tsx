import type { CockpitResponse } from '../../../lib/queries/admin-cockpit';

function rel(occurredAt: string): string {
  const days = Math.floor((Date.now() - new Date(occurredAt).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1d';
  return `${days}d`;
}

export function LatestActivityCard({ events }: { events: CockpitResponse['recentActivity'] }) {
  return (
    <section className="bg-surface border border-border-token rounded-card p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-sans text-xs text-fg-mute font-medium">
          Latest activity
        </p>
        <span className="font-sans text-xs text-fg-mute">
          last 30 days
        </span>
      </div>
      <ol className="mt-3 space-y-2.5">
        {events.length === 0 && (
          <li className="font-sans text-xs text-fg-mute">No activity recorded yet.</li>
        )}
        {events.map((e, i) => (
          <li key={i} className="flex items-baseline gap-3 font-sans text-xs">
            <span className="text-fg-mute tabular-nums shrink-0 w-12">{rel(e.occurredAt)}</span>
            <span className="w-1 h-1 rounded-full bg-fg-mute shrink-0" />
            <span className="text-fg-soft truncate">{e.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
