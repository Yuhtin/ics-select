import { clsx } from 'clsx';

export function BudgetBadge({
  plannedMinutes,
  budgetMinutes,
}: {
  plannedMinutes: number;
  budgetMinutes: number;
}) {
  if (budgetMinutes === 0) {
    return <span className="font-mono text-xs text-ink-mute">No availability declared yet.</span>;
  }
  const pct = Math.round((plannedMinutes / budgetMinutes) * 100);
  const tone =
    pct <= 80
      ? 'text-outcome-done-easy'
      : pct <= 100
        ? 'text-outcome-done-hard'
        : 'text-outcome-stuck';
  const label =
    pct <= 80 ? 'Fits availability' : pct <= 100 ? 'Near limit' : 'Over budget';
  return (
    <span className={clsx('font-mono text-xs tabular-nums', tone)}>
      {label} · {plannedMinutes} / {budgetMinutes} min ({pct}%)
    </span>
  );
}
