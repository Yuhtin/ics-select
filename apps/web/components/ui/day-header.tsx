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
    <div className={clsx('flex items-baseline justify-between gap-3 pt-6 pb-2', className)}>
      <h2 className="font-serif text-[22px] font-medium leading-none tracking-tight">{label}</h2>
      {hint && <span className="font-mono text-[11px] text-ink-mute">{hint}</span>}
    </div>
  );
}
