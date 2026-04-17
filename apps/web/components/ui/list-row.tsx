import { clsx } from 'clsx';
import type { ItemOutcome } from '@ics-select/shared';
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
  /** Visual emphasis lane. `late` = amber; `carried` = terracotta. */
  intent?: Intent;
  /** Platform the study material lives on (colors the stripe next to the title). */
  platform?: PlatformKey;
  title: ReactNode;
  meta?: ReactNode;
  /** Inline badge rendered after meta, e.g. "LATE" or "CARRIED OVER". */
  badge?: ReactNode;
  rightSlot?: ReactNode;
  onClick?: () => void;
  className?: string;
}

const INTENT_BORDER: Record<Intent, string> = {
  default: '',
  late: 'border-l-2 border-outcome-done-hard pl-3 -ml-3',
  carried: 'border-l-2 border-accent pl-3 -ml-3',
};

const PLATFORM_STRIPE: Record<PlatformKey, string> = {
  leetcode: 'bg-platform-leetcode',
  youtube: 'bg-platform-youtube',
  medium: 'bg-platform-medium',
  github: 'bg-platform-github',
  article: 'bg-platform-article',
  book: 'bg-platform-book',
};

export function ListRow({
  time,
  outcome = 'PENDING',
  active,
  intent = 'default',
  platform,
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
        'group flex w-full items-start gap-3 border-b border-rule py-3 text-left last:border-b-0',
        'transition-all duration-150',
        onClick &&
          'hover:border-b-ink/20 hover:bg-paper-warm/60 focus-visible:outline-none focus-visible:bg-paper-warm',
        INTENT_BORDER[intent],
        className,
      )}
    >
      {time !== undefined && (
        <span className="w-[52px] flex-none pt-1 font-mono text-[11px] tabular-nums text-ink-mute">
          {time}
        </span>
      )}
      <OutcomeDot outcome={outcome} size="md" active={active} className="mt-1.5 flex-none" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {platform && (
            <span
              aria-hidden
              className={clsx(
                'mt-1 inline-block h-3.5 w-[3px] flex-none rounded-[2px]',
                PLATFORM_STRIPE[platform],
              )}
            />
          )}
          <p
            className={clsx(
              'font-sans text-[15px] font-semibold leading-snug tracking-tight text-ink',
              outcome === 'DONE_EASY' && 'text-ink-mute line-through font-medium',
              'group-hover:text-ink',
            )}
          >
            {title}
          </p>
        </div>
        {(meta || badge) && (
          <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-label text-ink-mute">
            {meta}
            {badge && (
              <span
                className={clsx(
                  'inline-flex items-center rounded-pill px-1.5 py-0.5 text-[9px] font-bold',
                  intent === 'late' && 'bg-outcome-done-hard text-paper',
                  intent === 'carried' && 'bg-accent text-paper',
                  intent === 'default' && 'bg-ink text-paper',
                )}
              >
                {badge}
              </span>
            )}
          </p>
        )}
      </div>
      {rightSlot && <div className="flex-none pt-0.5">{rightSlot}</div>}
    </Wrapper>
  );
}
