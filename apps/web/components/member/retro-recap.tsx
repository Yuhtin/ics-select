'use client';
import type { WeekRecap, WeekRecapItem } from '../../lib/queries/me-retro';
import { formatMinutes } from '../../lib/format/time';
import { detectPlatform, platformLabel } from '../../lib/format/platform';

interface RetroRecapProps {
  recap: WeekRecap;
}

export function RetroRecap({ recap }: RetroRecapProps) {
  const { stats, items } = recap;
  return (
    <section className="border-t border-border-token pt-6">
      <p className="font-sans text-xs font-medium text-fg-mute">
        This week
      </p>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-[12px] tabular-nums text-fg-mute">
        <Stat label="nailed" value={stats.nailed} />
        <Stat label="hard"   value={stats.hard} />
        <Stat label="doubts" value={stats.doubts} />
        <Stat label="stuck"  value={stats.stuck} />
        <Stat label="skipped" value={stats.skipped} />
        {stats.minutesStudied > 0 && (
          <span className="text-fg">
            {formatMinutes(stats.minutesStudied)} studied
          </span>
        )}
      </div>
      <ul className="mt-5 divide-y divide-border-token">
        {items.map((it) => (
          <li key={it.id}>
            <RecapRow item={it} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <span className={value > 0 ? 'text-fg' : 'text-fg-mute'}>{value}</span>{' '}
      {label}
    </span>
  );
}

function RecapRow({ item }: { item: WeekRecapItem }) {
  const platform = detectPlatform(item.url, item.format);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-4 sm:flex-nowrap">
      <OutcomeChip outcome={item.outcome} />
      <p className="flex-1 min-w-0 truncate font-sans text-sm text-fg">
        {item.title}
      </p>
      <span className="font-sans text-xs text-fg-mute">
        {platformLabel(platform)} · {formatMinutes(item.estimatedMinutes)}
      </span>
    </div>
  );
}

function OutcomeChip({ outcome }: { outcome: WeekRecapItem['outcome'] }) {
  const config: Record<WeekRecapItem['outcome'], { label: string; cls: string }> = {
    DONE_EASY: { label: 'Nailed',   cls: 'bg-outcome-done-easy/10 text-fg border-outcome-done-easy/30' },
    DONE_HARD: { label: 'Hard',     cls: 'bg-outcome-done-hard/10 text-fg border-outcome-done-hard/30' },
    DOUBTS:    { label: 'Doubts',   cls: 'bg-outcome-doubts/10 text-fg border-outcome-doubts/30' },
    STUCK:     { label: 'Stuck',    cls: 'bg-outcome-stuck/10 text-fg border-outcome-stuck/30' },
    SKIPPED:   { label: 'Skipped',  cls: 'bg-outcome-skipped/10 text-fg border-outcome-skipped/30' },
    PENDING:   { label: 'Pending',  cls: 'bg-outcome-pending/10 text-fg border-outcome-pending/30' },
  };
  const { label, cls } = config[outcome];
  return (
    <span
      className={`inline-flex w-[68px] shrink-0 justify-center rounded-input border px-2 py-1 font-sans text-xs ${cls}`}
    >
      {label}
    </span>
  );
}
