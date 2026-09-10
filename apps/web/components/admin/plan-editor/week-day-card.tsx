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

export type DayCardSlot = {
  startMinute: number;
  endMinute: number;
  /** Slot end already passed in the member's timezone. */
  isPast?: boolean;
};
export type DayCardBusyBlock = { startMinute: number; endMinute: number };

export type WeekDayCardProps = {
  label: string;
  dateLabel: string;
  capMinutes: number | null;
  slots: DayCardSlot[];
  busyBlocks?: DayCardBusyBlock[];
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
  // Cap is set but the member has no AvailabilitySlot rows for this weekday —
  // scheduler has no window to place anything, so the cap is dead. Treat as
  // "no slots" rather than free time to avoid misleading "FREE Nm" in the
  // footer.
  const noSlots = !isOff && props.slots.length === 0;
  const futureSlots = props.slots.filter((s) => !s.isPast);
  // All declared slots are already in the past in the member's timezone —
  // scheduler can't use this day anymore. Treat similarly to noSlots.
  const allPast = !isOff && !noSlots && futureSlots.length === 0;
  const scheduledMinutes = props.items.reduce((sum, i) => sum + i.durationMinutes, 0);
  // How many minutes does Calendar busy consume *inside* the future slots?
  // Anything outside the slots doesn't reduce free capacity (the member never
  // claimed it as study time). busyBlocks are already adjusted (own ICS events
  // subtracted) so they represent only external conflicts.
  const busyInSlots = (props.busyBlocks ?? []).reduce((sum, b) => {
    for (const s of futureSlots) {
      const overlap = Math.max(
        0,
        Math.min(b.endMinute, s.endMinute) - Math.max(b.startMinute, s.startMinute),
      );
      sum += overlap;
    }
    return sum;
  }, 0);
  // The scheduler inserts a 10-min buffer between consecutive items in the same
  // slot. Account for this so "free" reflects what truly fits next, not the raw
  // remaining minutes minus items.
  const BUFFER_MINUTES = 10;
  const bufferCost = props.items.length > 0 ? BUFFER_MINUTES : 0;
  const free =
    isOff || noSlots || allPast
      ? 0
      : Math.max(0, (props.capMinutes ?? 0) - scheduledMinutes - busyInSlots - bufferCost);

  return (
    <div
      className={clsx(
        'rounded-card border bg-surface p-3 min-w-0',
        props.contributesOverflow ? 'border-l-2 border-l-outcome-stuck' : 'border-border-token',
        (isOff || noSlots || allPast) && 'bg-bg-subtle',
      )}
    >
      <header className="mb-2">
        <p className="font-sans text-sm font-semibold text-fg">{props.label}</p>
        <p className="font-sans text-xs text-fg-mute">
          {props.dateLabel}
        </p>
      </header>

      <div className="mb-2 space-y-0.5">
        <p
          className={clsx(
            'font-sans text-xs',
            isOff || noSlots || allPast ? 'italic text-fg-mute' : 'text-fg-soft',
          )}
        >
          {isOff ? 'OFF' : `${props.capMinutes}m cap`}
        </p>
        {noSlots && (
          <p className="font-sans text-xs italic text-fg-mute">no slot · sem janela</p>
        )}
        {allPast && (
          <p className="font-sans text-xs italic text-fg-mute">passou · slots no passado</p>
        )}
        {!isOff &&
          props.slots.map((s, idx) => (
            <p
              key={idx}
              className={clsx(
                'font-sans text-xs tabular-nums',
                s.isPast ? 'text-fg-mute line-through' : 'text-fg-mute',
              )}
            >
              {formatSlot(s)}
            </p>
          ))}
        {!isOff && !noSlots && (props.busyBlocks ?? []).length > 0 && (
          <div className="space-y-0.5 pt-1">
            {(props.busyBlocks ?? []).map((b, idx) => (
              <p
                key={idx}
                className="font-sans text-xs tabular-nums text-outcome-stuck"
                title="Google Calendar busy"
              >
                ⊘ busy {formatSlot(b)}
              </p>
            ))}
          </div>
        )}
      </div>

      <hr className="my-2 border-border-token" />

      <div className="space-y-2">
        {props.items.length === 0 ? (
          <p className="font-sans text-xs italic text-fg-mute">—</p>
        ) : (
          props.items.map((item) => {
            const platform = detectPlatform(item.url, item.format);
            return (
              <button
                type="button"
                key={item.itemId}
                onClick={() => props.onItemClick?.(item.libraryItemId)}
                className="group block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <p className="font-sans text-xs tabular-nums text-fg-mute">
                  {formatTimeLocal(item.scheduledAt)}
                </p>
                <div
                  className="mt-0.5 flex items-start gap-2 border-l-[3px] pl-2"
                  style={{ borderLeftColor: `hsl(var(--platform-${platform}, var(--border-strong)))` }}
                >
                  <span
                    className={clsx(
                      'mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full',
                      OUTCOME_DOT[item.outcome],
                    )}
                  />
                  <p className="line-clamp-2 font-sans text-xs text-fg group-hover:text-fg-soft">
                    {item.title}
                  </p>
                </div>
                <p className="ml-2 mt-0.5 font-sans text-xs text-fg-mute">
                  {platformLabel(platform)} · {formatMinutes(item.durationMinutes)}
                </p>
              </button>
            );
          })
        )}
      </div>

      <hr className="my-2 border-border-token" />

      <p
        className={clsx(
          'font-sans text-xs',
          isOff || noSlots || allPast
            ? 'italic text-fg-mute'
            : free > 0
              ? 'text-outcome-done-easy'
              : 'text-fg-mute',
        )}
      >
        {isOff || noSlots || allPast ? '—' : `free ${free}m`}
      </p>
    </div>
  );
}
