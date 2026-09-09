import { clsx } from 'clsx';
import { isPositiveOutcome, type ItemOutcome } from '@ics-select/shared';
import type { ReactNode } from 'react';
import { OutcomeDot } from './outcome-dot';

type Intent = 'default' | 'late' | 'carried';
export type PlatformKey = 'leetcode' | 'youtube' | 'medium' | 'github' | 'article' | 'book';

interface ListRowProps {
  /** Left-aligned tabular time, e.g. "19:00". Optional. */
  time?: string;
  outcome?: ItemOutcome;
  /** Shown with ring when the row is the "now" item. */
  active?: boolean;
  /** Status intent retained for callers; late/carried copy is supplied by badge. */
  intent?: Intent;
  /** Platform metadata; retained for callers that supply it. */
  platform?: PlatformKey;
  title: ReactNode;
  meta?: ReactNode;
  /** Plain status text rendered after meta, e.g. "LATE" or "CARRIED OVER". */
  badge?: ReactNode;
  rightSlot?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function ListRow({
  time,
  outcome = 'PENDING',
  active,
  title,
  meta,
  badge,
  rightSlot,
  onClick,
  className,
}: ListRowProps) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'group flex min-h-11 w-full items-start gap-3 border-b border-border-token py-3 text-left last:border-b-0',
        'transition-colors duration-150',
        onClick &&
          'hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        className,
      )}
    >
      {time !== undefined && (
        <span className="w-[52px] flex-none pt-1 font-mono text-[11px] tabular-nums text-fg-mute">
          {time}
        </span>
      )}
      <OutcomeDot outcome={outcome} size="md" active={active} className="mt-1.5 flex-none" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p
            className={clsx(
              'font-sans text-[15px] font-semibold leading-snug tracking-tight',
              isPositiveOutcome(outcome) ? 'text-fg-mute line-through font-medium' : 'text-fg',
              'group-hover:text-fg',
            )}
          >
            {title}
          </p>
        </div>
        {(meta || badge) && (
          <p className="mt-1 flex flex-wrap items-center gap-2 font-sans text-[10px] uppercase tracking-label text-fg-mute">
            {meta}
            {badge && <span className="font-semibold text-fg-soft">{badge}</span>}
          </p>
        )}
      </div>
      {rightSlot && <div className="flex-none pt-0.5">{rightSlot}</div>}
    </Wrapper>
  );
}
