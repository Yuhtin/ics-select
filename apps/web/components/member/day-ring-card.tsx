'use client';

import type { HomeItem } from '../../lib/queries/me-home';
import { ProgressRing } from '../ui/progress-ring';
import { SegmentedProgress, type SegmentState } from '../ui/segmented-progress';
import { formatMinutes } from '../../lib/format/time';

interface DayRingCardProps {
  items: HomeItem[];
  nowItemId?: string | null;
}

function segmentFor(item: HomeItem, nowId?: string | null): SegmentState {
  if (item.outcome === 'DONE_EASY') return 'done';
  if (item.outcome === 'DONE_HARD') return 'hard';
  if (item.outcome === 'STUCK') return 'stuck';
  if (item.outcome === 'DOUBTS') return 'doubts';
  if (item.id === nowId) return 'now';
  return 'pending';
}

export function DayRingCard({ items, nowItemId }: DayRingCardProps) {
  const total = items.length;
  const done = items.filter(
    (i) => i.outcome === 'DONE_EASY' || i.outcome === 'DONE_HARD',
  ).length;
  const pct = total === 0 ? 0 : done / total;
  const remainingMinutes = items
    .filter((i) => i.outcome === 'PENDING')
    .reduce((sum, i) => sum + (i.scheduledMinutes ?? i.estimatedMinutes), 0);
  const segments: SegmentState[] = items.map((i) => segmentFor(i, nowItemId));

  return (
    <section className="flex flex-col items-center rounded-tile border border-border-token bg-surface p-6">
      <ProgressRing
        value={pct}
        size={148}
        thickness={12}
        tone="success"
        label={total > 0 ? `${done}/${total}` : '0/0'}
        subLabel="Today"
      />
      {segments.length > 0 && (
        <SegmentedProgress segments={segments} className="mt-5 w-full" />
      )}
      <p className="mt-3 font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
        {total === 0
          ? 'No items scheduled today.'
          : total - done > 0
            ? `${total - done} remaining · ~${formatMinutes(remainingMinutes)}`
            : 'All done today.'}
      </p>
    </section>
  );
}
