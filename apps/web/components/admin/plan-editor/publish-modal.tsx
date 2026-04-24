'use client';
import 'temporal-polyfill/global';
import { useMemo, useState } from 'react';
import { X, Zap } from 'lucide-react';

export interface PublishModalProps {
  open: boolean;
  onClose: () => void;
  /** UTC midnight Monday ISO — the plan's first day. */
  planWeekStart: string;
  /** Member timezone, e.g. "America/Sao_Paulo". */
  memberTimezone: string;
  publishing: boolean;
  defaultSendWhatsapp: boolean;
  defaultAutoSchedule: boolean;
  onSubmit: (input: {
    /** UTC ISO string or null for publish-now. */
    publishAt: string | null;
    sendWhatsapp: boolean;
    autoSchedule: boolean;
  }) => void;
}

/**
 * Given the plan's UTC weekStart + member tz, build a default "first day of
 * the plan's week at 07:00 member tz" Temporal.ZonedDateTime. Extracting the
 * date in UTC (since weekStart is UTC midnight Monday) avoids the viewer's
 * local tz pulling it a day earlier.
 */
function defaultPublishAt(
  planWeekStart: string,
  memberTimezone: string,
): Temporal.ZonedDateTime {
  const instant = Temporal.Instant.from(planWeekStart);
  const utcZoned = instant.toZonedDateTimeISO('UTC');
  return Temporal.ZonedDateTime.from({
    year: utcZoned.year,
    month: utcZoned.month,
    day: utcZoned.day,
    hour: 7,
    minute: 0,
    timeZone: memberTimezone,
  });
}

function toDatetimeLocalValue(zdt: Temporal.ZonedDateTime): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${zdt.year}-${pad(zdt.month)}-${pad(zdt.day)}T${pad(zdt.hour)}:${pad(zdt.minute)}`;
}

function datetimeLocalToIso(
  value: string,
  memberTimezone: string,
): string {
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) throw new Error('invalid datetime-local');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return Temporal.ZonedDateTime.from({
    year: y!,
    month: m!,
    day: d!,
    hour: h!,
    minute: min!,
    timeZone: memberTimezone,
  })
    .toInstant()
    .toString();
}

function formatWhenLabel(
  zdt: Temporal.ZonedDateTime,
  memberTimezone: string,
): string {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: memberTimezone,
  }).format(new Date(zdt.toInstant().epochMilliseconds));
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: memberTimezone,
  }).format(new Date(zdt.toInstant().epochMilliseconds));
  return `${weekday} · ${time}`;
}

export function PublishModal({
  open,
  onClose,
  planWeekStart,
  memberTimezone,
  publishing,
  defaultSendWhatsapp,
  defaultAutoSchedule,
  onSubmit,
}: PublishModalProps) {
  const defaultZdt = useMemo(
    () => defaultPublishAt(planWeekStart, memberTimezone),
    [planWeekStart, memberTimezone],
  );
  const [mode, setMode] = useState<'scheduled' | 'now'>('scheduled');
  const [when, setWhen] = useState(() => toDatetimeLocalValue(defaultZdt));
  const [sendWhatsapp, setSendWhatsapp] = useState(defaultSendWhatsapp);
  const [autoSchedule, setAutoSchedule] = useState(defaultAutoSchedule);

  if (!open) return null;

  const previewLabel =
    mode === 'now'
      ? 'Publishing now'
      : (() => {
          try {
            const iso = datetimeLocalToIso(when, memberTimezone);
            const zdt = Temporal.Instant.from(iso).toZonedDateTimeISO(memberTimezone);
            return formatWhenLabel(zdt, memberTimezone);
          } catch {
            return '—';
          }
        })();

  const handleSubmit = () => {
    if (mode === 'now') {
      onSubmit({ publishAt: null, sendWhatsapp, autoSchedule });
      return;
    }
    try {
      const iso = datetimeLocalToIso(when, memberTimezone);
      onSubmit({ publishAt: iso, sendWhatsapp, autoSchedule });
    } catch {
      // ignore invalid
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-card bg-surface border border-rule shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-rule px-6 py-4">
          <div>
            <h3 className="font-serif-tool text-xl font-semibold text-ink">
              Publish plan
            </h3>
            <p className="mt-1 font-mono text-[11px] text-ink-mute">
              Member timezone · {memberTimezone}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-pill text-ink-mute hover:bg-paper-warm hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </header>

        <div className="px-6 py-5 space-y-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute mb-2">
              When
            </div>
            <div className="flex gap-2">
              <label className="flex-1 flex items-center gap-2 rounded-input border border-rule px-3 py-2 cursor-pointer hover:bg-paper-warm">
                <input
                  type="radio"
                  name="publish-mode"
                  value="scheduled"
                  checked={mode === 'scheduled'}
                  onChange={() => setMode('scheduled')}
                  className="accent-ink"
                />
                <span className="font-mono text-xs uppercase tracking-label text-ink">
                  Scheduled
                </span>
              </label>
              <label className="flex-1 flex items-center gap-2 rounded-input border border-rule px-3 py-2 cursor-pointer hover:bg-paper-warm">
                <input
                  type="radio"
                  name="publish-mode"
                  value="now"
                  checked={mode === 'now'}
                  onChange={() => setMode('now')}
                  className="accent-ink"
                />
                <span className="font-mono text-xs uppercase tracking-label text-ink">
                  Publish now
                </span>
              </label>
            </div>
            {mode === 'scheduled' && (
              <div className="mt-3">
                <input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className="w-full rounded-input border border-rule bg-paper px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
                />
                <p className="mt-1 font-mono text-[10px] text-ink-mute">
                  Will publish at <span className="text-ink">{previewLabel}</span> (member time).
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSchedule}
                onChange={(e) => setAutoSchedule(e.target.checked)}
                className="accent-ink"
              />
              <span className="font-sans text-sm text-ink">
                Create Google Calendar events
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sendWhatsapp}
                onChange={(e) => setSendWhatsapp(e.target.checked)}
                className="accent-ink"
              />
              <span className="font-sans text-sm text-ink">
                Send WhatsApp notification to member
              </span>
            </label>
          </div>
        </div>

        <footer className="border-t border-rule px-6 py-3 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={publishing}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 text-ink-soft hover:bg-paper-warm rounded-pill disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={publishing}
            className="inline-flex items-center gap-2 bg-ink text-paper rounded-pill px-4 py-2 font-mono text-xs uppercase tracking-label hover:opacity-90 disabled:opacity-40"
          >
            <Zap className="h-4 w-4" strokeWidth={1.5} />
            {publishing ? 'Publishing…' : mode === 'now' ? 'Publish now' : 'Schedule publish'}
          </button>
        </footer>
      </div>
    </div>
  );
}
