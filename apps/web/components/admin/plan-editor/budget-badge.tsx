import { clsx } from 'clsx';

export interface BudgetBadgeProps {
  /** Sum of allocated minutes across all non-SKIPPED items in the plan. */
  plannedMinutes: number;
  /** Total weekly budget = sum of per-day caps from MemberAvailability. */
  budgetMinutes: number;
  /**
   * Minutes still addable this week — derived from slot windows from today
   * onwards minus actual Google Calendar busy. Null when the calendar
   * lookup failed; the badge falls back to the old planned-vs-budget signal.
   */
  remainingMinutes: number | null;
  /** Sum of allocated minutes for items NOT yet done (PENDING + STUCK). */
  pendingMinutes: number;
  /** Days from today through Sunday with non-zero capacity. */
  daysRemaining: number;
}

/**
 * Two readings, side by side:
 *   1. "Planned X / Y min" — historical, never changes color. Tells the admin
 *      how full the week was intended to be.
 *   2. "Fits / Tight / Over · Δ min · N days" — actionable, keyed off
 *      pending-vs-remaining-capacity. This is what tells the admin whether
 *      they can still cram more work in.
 *
 * Why two numbers: when a member finishes early, the Calendar event moves
 * to "now" and frees slots. The historical "planned" stays at 285/300 (the
 * week IS that full), but "remaining" jumps because pending + free-slots
 * now allow more. Old single-bar badge couldn't show both stories.
 *
 * Falls back to a single planned-vs-budget bar when the calendar lookup
 * fails (`remainingMinutes === null`) so the editor still works offline.
 */
export function BudgetBadge({
  plannedMinutes,
  budgetMinutes,
  remainingMinutes,
  pendingMinutes,
  daysRemaining,
}: BudgetBadgeProps) {
  if (budgetMinutes === 0) {
    return <span className="font-mono text-xs text-ink-mute">No availability declared yet.</span>;
  }

  const plannedPct = Math.round((plannedMinutes / budgetMinutes) * 100);

  // Calendar offline — degrade to the old behavior so the badge still works.
  if (remainingMinutes === null) {
    const tone =
      plannedPct <= 80
        ? 'text-outcome-done-easy'
        : plannedPct <= 100
          ? 'text-outcome-done-hard'
          : 'text-outcome-stuck';
    const label =
      plannedPct <= 80 ? 'Fits availability' : plannedPct <= 100 ? 'Near limit' : 'Over budget';
    return (
      <span className={clsx('font-mono text-xs tabular-nums', tone)}>
        {label} · {plannedMinutes} / {budgetMinutes} min ({plannedPct}%)
      </span>
    );
  }

  const headroom = remainingMinutes - pendingMinutes;
  const overflow = -headroom;

  let chipLabel: string;
  let chipDetail: string;
  let tone: string;
  if (pendingMinutes === 0 && daysRemaining === 0) {
    chipLabel = 'Week complete';
    chipDetail = '';
    tone = 'text-ink-mute';
  } else if (pendingMinutes === 0) {
    chipLabel = 'All caught up';
    chipDetail = `${remainingMinutes} min open · ${daysRemaining} days left`;
    tone = 'text-outcome-done-easy';
  } else if (headroom >= 0) {
    chipLabel = 'Fits remaining';
    chipDetail = `${headroom} min headroom · ${daysRemaining} days left`;
    tone = 'text-outcome-done-easy';
  } else if (overflow <= 30) {
    chipLabel = 'Tight';
    chipDetail = `${overflow} min over · ${daysRemaining} days left`;
    tone = 'text-outcome-done-hard';
  } else {
    chipLabel = 'Over capacity';
    chipDetail = `${overflow} min over · ${daysRemaining} days left`;
    tone = 'text-outcome-stuck';
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-mono text-xs tabular-nums text-ink-mute">
        Planned {plannedMinutes} / {budgetMinutes} min ({plannedPct}%)
      </span>
      <span className={clsx('font-mono text-xs tabular-nums', tone)}>
        {chipLabel}
        {chipDetail ? ` · ${chipDetail}` : ''}
      </span>
    </div>
  );
}
