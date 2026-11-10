'use client';
import { useOpportunities } from '../../../lib/queries/opportunities';
import { shortDate } from '../../opportunities/opportunity-card';

/** Open opportunities this member flagged. Renders nothing when empty, loading or failed. */
export function InterestedInCard({ userId }: { userId: string }) {
  const { data } = useOpportunities({ interestedBy: userId });
  if (!data || data.length === 0) return null;
  return (
    <section className="rounded-card border border-border-token bg-surface p-5">
      <p className="font-sans text-xs font-medium text-fg-mute">Interested in</p>
      <ul className="mt-3 divide-y divide-border-token">
        {data.map((o) => {
          const date = o.deadline ?? o.eventDate;
          return (
            <li key={o.id} className="flex items-baseline justify-between gap-4 py-2 font-sans text-sm">
              <span className="min-w-0 text-fg">
                {o.title} <span className="text-fg-mute">· {o.companyName}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-fg-mute">{date ? `Closes ${shortDate(date)}` : 'No deadline'}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
