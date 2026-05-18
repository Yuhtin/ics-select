'use client';
import { clsx } from 'clsx';
import type { ItemOutcome } from '@ics-select/shared';
import { detectPlatform, platformLabel } from '../../../lib/format/platform';
import { formatTimeLocal, formatMinutes } from '../../../lib/format/time';

export type DayCardItem = {
  itemId: string;
  libraryItemId: string;
  title: string;
  format: string;
  url?: string | null;
  outcome: ItemOutcome;
  scheduledAt: string;
  durationMinutes: number;
};

export type DayCardSlot = { startMinute: number; endMinute: number };

export type WeekDayCardProps = {
  label: string;
  dateLabel: string;
  capMinutes: number | null;
  slots: DayCardSlot[];
  items: DayCardItem[];
  contributesOverflow?: boolean;
  onItemClick?: (libraryItemId: string) => void;
};

const OUTCOME_DOT: Record<ItemOutcome, string> = {
  PENDING: 'bg-outcome-pending',
  DONE_EASY: 'bg-outcome-done-easy',
  DONE_HARD: 'bg-outcome-done-hard',
  DOUBTS: 'bg-outcome-doubts',
  STUCK: 'bg-outcome-stuck',
  SKIPPED: 'bg-outcome-pending',
};

function formatSlot(s: DayCardSlot): string {
  const fmt = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return `${fmt(s.startMinute)}–${fmt(s.endMinute)}`;
}

export function WeekDayCard(props: WeekDayCardProps) {
  const isOff = !props.capMinutes || props.capMinutes === 0;
  const scheduledMinutes = props.items.reduce((sum, i) => sum + i.durationMinutes, 0);
  const free = isOff ? 0 : Math.max(0, (props.capMinutes ?? 0) - scheduledMinutes);

  return (
    <div
      className={clsx(
        'rounded-card border bg-surface p-3 min-w-0',
        props.contributesOverflow ? 'border-l-2 border-l-outcome-stuck' : 'border-rule',
        isOff && 'bg-paper-warm',
      )}
    >
      <header className="mb-2">
        <p className="font-serif-tool text-sm font-semibold text-ink">{props.label}</p>
        <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
          {props.dateLabel}
        </p>
      </header>

      <div className="mb-2 space-y-0.5">
        <p
          className={clsx(
            'font-mono text-[10px] uppercase tracking-label',
            isOff ? 'italic text-ink-mute' : 'text-ink-soft',
          )}
        >
          {isOff ? 'OFF' : `${props.capMinutes}m cap`}
        </p>
        {!isOff &&
          props.slots.map((s, idx) => (
            <p
              key={idx}
              className="font-mono text-[10px] text-ink-mute tabular-nums"
            >
              {formatSlot(s)}
            </p>
          ))}
      </div>

      <hr className="my-2 border-rule" />

      <div className="space-y-2">
        {props.items.length === 0 ? (
          <p className="font-sans text-xs italic text-ink-faint">—</p>
        ) : (
          props.items.map((item) => {
            const platform = detectPlatform(item.url, item.format);
            return (
              <button
                type="button"
                key={item.itemId}
                onClick={() => props.onItemClick?.(item.libraryItemId)}
                className="group block w-full text-left"
              >
                <p className="font-mono text-[10px] tabular-nums text-ink-mute">
                  {formatTimeLocal(item.scheduledAt)}
                </p>
                <div
                  className="mt-0.5 flex items-start gap-2 border-l-[3px] pl-2"
                  style={{ borderLeftColor: `var(--platform-${platform})` }}
                >
                  <span
                    className={clsx(
                      'mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full',
                      OUTCOME_DOT[item.outcome],
                    )}
                  />
                  <p className="line-clamp-2 font-sans text-xs text-ink group-hover:text-ink-soft">
                    {item.title}
                  </p>
                </div>
                <p className="ml-2 mt-0.5 font-mono text-[9px] uppercase tracking-label text-ink-mute">
                  {platformLabel(platform)} · {formatMinutes(item.durationMinutes)}
                </p>
              </button>
            );
          })
        )}
      </div>

      <hr className="my-2 border-rule" />

      <p
        className={clsx(
          'font-mono text-[10px] uppercase tracking-label',
          isOff
            ? 'italic text-ink-mute'
            : free > 0
              ? 'text-outcome-done-easy'
              : 'text-ink-mute',
        )}
      >
        {isOff ? '—' : `free ${free}m`}
      </p>
    </div>
  );
}
