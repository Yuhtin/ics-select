import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface DayHeaderProps {
  label: ReactNode;
  /** Small description under the label, e.g. "3 items · 120 min". */
  hint?: ReactNode;
  className?: string;
}

export function DayHeader({ label, hint, className }: DayHeaderProps) {
  return (
    <div className={clsx('flex flex-wrap items-baseline justify-between gap-3 pt-6 pb-2', className)}>
      <h2 className="font-sans text-xl font-semibold leading-snug tracking-tight text-fg">{label}</h2>
      {hint && <span className="font-sans text-xs text-fg-mute">{hint}</span>}
    </div>
  );
}
