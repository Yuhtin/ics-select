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
  // claimed it as study time).
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
  const free =
    isOff || noSlots || allPast
      ? 0
      : Math.max(0, (props.capMinutes ?? 0) - scheduledMinutes - busyInSlots);

  return (
    <div
      className={clsx(
        'rounded-card border bg-surface p-3 min-w-0',
        props.contributesOverflow ? 'border-l-2 border-l-outcome-stuck' : 'border-rule',
        (isOff || noSlots || allPast) && 'bg-paper-warm',
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
            isOff || noSlots || allPast ? 'italic text-ink-mute' : 'text-ink-soft',
          )}
        >
          {isOff ? 'OFF' : `${props.capMinutes}m cap`}
        </p>
        {noSlots && (
          <p className="font-mono text-[10px] italic text-ink-mute">no slot · sem janela</p>
        )}
        {allPast && (
          <p className="font-mono text-[10px] italic text-ink-mute">passou · slots no passado</p>
        )}
        {!isOff &&
          props.slots.map((s, idx) => (
            <p
              key={idx}
              className={clsx(
                'font-mono text-[10px] tabular-nums',
                s.isPast ? 'text-ink-faint line-through' : 'text-ink-mute',
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
                className="font-mono text-[10px] tabular-nums text-outcome-stuck"
                title="Google Calendar busy"
              >
                ⊘ busy {formatSlot(b)}
              </p>
            ))}
          </div>
        )}
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
          isOff || noSlots || allPast
            ? 'italic text-ink-mute'
            : free > 0
              ? 'text-outcome-done-easy'
              : 'text-ink-mute',
        )}
      >
        {isOff || noSlots || allPast ? '—' : `free ${free}m`}
      </p>
    </div>
  );
}
