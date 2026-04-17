import { clsx } from 'clsx';
import type { ItemOutcome } from '@ics-select/shared';
import type { ReactNode } from 'react';
import { OutcomeDot } from './outcome-dot';

interface ListRowProps {
  /** Left-aligned tabular time, e.g. "19:00". Optional. */
  time?: string;
  outcome?: ItemOutcome;
  /** Shown with ring when the row is the "now" item. */
  active?: boolean;
  title: ReactNode;
  meta?: ReactNode;
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
        'flex w-full items-start gap-3 border-b border-rule py-3 text-left last:border-b-0',
        onClick && 'hover:bg-paper-warm focus-visible:outline-none focus-visible:bg-paper-warm',
        'transition-colors',
        className,
      )}
    >
      {time !== undefined && (
        <span className="w-[52px] flex-none pt-0.5 font-mono text-[11px] tabular-nums text-ink-mute">
          {time}
        </span>
      )}
      <OutcomeDot outcome={outcome} size="md" active={active} className="mt-1 flex-none" />
      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            'font-serif text-[15px] font-medium leading-tight',
            outcome === 'DONE_EASY' && 'text-ink-mute line-through',
          )}
        >
          {title}
        </p>
        {meta && <p className="mt-1 font-mono text-[10px] uppercase tracking-label text-ink-mute">{meta}</p>}
      </div>
      {rightSlot && <div className="flex-none pt-0.5">{rightSlot}</div>}
    </Wrapper>
  );
}
