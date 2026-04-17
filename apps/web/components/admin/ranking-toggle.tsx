'use client';
import { clsx } from 'clsx';
import { useToggleRanking } from '../../lib/queries/admin-cycle';

export function RankingToggle({
  cycleId,
  checked,
}: {
  cycleId: string;
  checked: boolean;
}) {
  const toggle = useToggleRanking();
  const optimistic = toggle.isPending ? !checked : checked;
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] uppercase tracking-eyebrow text-ink-mute font-semibold">
        Cohort ranking
      </span>
      <button
        type="button"
        onClick={() =>
          toggle.mutate({ cycleId, rankingVisibleToMembers: !checked })
        }
        disabled={toggle.isPending}
        className={clsx(
          'relative inline-flex h-6 w-10 items-center rounded-full border border-rule transition-colors',
          optimistic ? 'bg-paper-warm' : 'bg-paper',
          toggle.isPending && 'opacity-60',
        )}
        aria-pressed={optimistic}
        aria-label="Toggle cohort ranking visibility"
      >
        <span
          className={clsx(
            'inline-block h-4 w-4 rounded-full transition-transform',
            optimistic ? 'translate-x-5 bg-ink' : 'translate-x-1 bg-ink-faint',
          )}
        />
      </button>
      <span className="font-mono text-[11px] text-ink-mute">
        {optimistic ? 'visible to members' : 'hidden from members'}
      </span>
    </div>
  );
}
