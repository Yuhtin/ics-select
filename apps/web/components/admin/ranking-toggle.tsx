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
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-sans text-xs text-fg-mute font-semibold">
        Cohort ranking
      </span>
      <button
        type="button"
        onClick={() =>
          toggle.mutate({ cycleId, rankingVisibleToMembers: !checked })
        }
        disabled={toggle.isPending}
        className={clsx(
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface relative inline-flex h-6 w-10 items-center rounded-full border border-border-token transition-colors',
          optimistic ? 'bg-primary' : 'bg-bg-subtle',
          toggle.isPending && 'opacity-60',
        )}
        aria-pressed={optimistic}
        aria-label="Toggle cohort ranking visibility"
      >
        <span
          className={clsx(
            'inline-block h-4 w-4 rounded-full transition-transform',
            optimistic ? 'translate-x-5 bg-primary-fg' : 'translate-x-1 bg-fg-mute',
          )}
        />
      </button>
      <span className="font-sans text-xs text-fg-mute">
        {optimistic ? 'visible to members' : 'hidden from members'}
      </span>
    </div>
  );
}
