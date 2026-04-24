'use client';
import { useMemo } from 'react';
import { X, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import type { AvailabilitySlot } from '../../lib/queries/me-settings';
import { TimePill } from './time-pill';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Props = {
  slots: AvailabilitySlot[];
  onChange: (next: AvailabilitySlot[]) => void;
};

export function AvailabilitySlotEditor({ slots, onChange }: Props) {
  const byDay = useMemo(() => {
    const m = new Map<number, AvailabilitySlot[]>();
    for (let d = 0; d < 7; d++) m.set(d, []);
    for (const s of slots) m.get(s.dayOfWeek)!.push(s);
    for (const list of m.values()) list.sort((a, b) => a.startMinute - b.startMinute);
    return m;
  }, [slots]);

  function setDaySlots(day: number, next: AvailabilitySlot[]) {
    const other = slots.filter((s) => s.dayOfWeek !== day);
    onChange([...other, ...next]);
  }

  function addSlot(day: number) {
    const existing = byDay.get(day) ?? [];
    const lastEnd = existing.length > 0 ? existing[existing.length - 1]!.endMinute : 18 * 60;
    if (lastEnd >= 24 * 60 - 30) return; // no room for a 30-min slot
    const start = lastEnd;
    const end = Math.min(start + 120, 24 * 60);
    setDaySlots(day, [
      ...existing,
      { dayOfWeek: day, startMinute: start, endMinute: end },
    ]);
  }

  function removeSlot(day: number, idx: number) {
    const existing = byDay.get(day) ?? [];
    setDaySlots(day, existing.filter((_, i) => i !== idx));
  }

  function updateSlot(day: number, idx: number, patch: Partial<AvailabilitySlot>) {
    const existing = byDay.get(day) ?? [];
    const next = existing.map((s, i) => {
      if (i !== idx) return s;
      const merged = { ...s, ...patch };
      // If start moved at or past end, push end forward to keep a 30-min minimum.
      if (merged.endMinute <= merged.startMinute) {
        merged.endMinute = Math.min(merged.startMinute + 30, 24 * 60);
      }
      return merged;
    });
    setDaySlots(day, next);
  }

  return (
    <div className="space-y-2">
      {DAY_SHORT.map((label, day) => {
        const daySlots = byDay.get(day) ?? [];
        const overlap = detectOverlap(daySlots);
        return (
          <div
            key={day}
            className={clsx(
              'rounded-input border bg-surface px-4 py-3',
              overlap ? 'border-outcome-stuck' : 'border-border-token',
            )}
          >
            <div className="flex items-start gap-4">
              <span className="mt-2 w-12 shrink-0 font-mono text-[11px] font-semibold uppercase tracking-eyebrow text-fg-mute">
                {label}
              </span>
              <div className="flex-1 space-y-2">
                {daySlots.length === 0 && (
                  <p className="pt-1.5 font-sans text-[13px] text-fg-faint">
                    indisponível
                  </p>
                )}
                {daySlots.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <TimePill
                      value={s.startMinute}
                      onChange={(v) => updateSlot(day, idx, { startMinute: v })}
                      maxMinuteExclusive={s.endMinute}
                      ariaLabel={`${label} start`}
                    />
                    <span className="font-sans text-[13px] text-fg-mute">–</span>
                    <TimePill
                      value={s.endMinute}
                      onChange={(v) => updateSlot(day, idx, { endMinute: v })}
                      minMinuteExclusive={s.startMinute}
                      allowEndOfDay
                      ariaLabel={`${label} end`}
                    />
                    <button
                      type="button"
                      onClick={() => removeSlot(day, idx)}
                      className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-pill border border-transparent text-fg-mute transition-colors hover:border-border-token hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label={`Remove ${label} slot ${idx + 1}`}
                    >
                      <X className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSlot(day)}
                  className="inline-flex items-center gap-1.5 rounded-input px-2 py-1 font-sans text-[13px] text-fg-mute transition-colors hover:bg-bg-subtle hover:text-fg"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  adicionar faixa
                </button>
              </div>
            </div>
            {overlap && (
              <p className="mt-2 pl-[64px] font-mono text-[11px] text-outcome-stuck">
                faixas se sobrepõem — ajuste pra salvar
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function detectOverlap(list: AvailabilitySlot[]): boolean {
  for (const s of list) {
    if (s.endMinute <= s.startMinute) return true;
  }
  const sorted = [...list].sort((a, b) => a.startMinute - b.startMinute);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.startMinute < sorted[i - 1]!.endMinute) return true;
  }
  return false;
}

export function hasAnyOverlap(slots: AvailabilitySlot[]): boolean {
  const byDay = new Map<number, AvailabilitySlot[]>();
  for (const s of slots) {
    const list = byDay.get(s.dayOfWeek) ?? [];
    list.push(s);
    byDay.set(s.dayOfWeek, list);
  }
  for (const list of byDay.values()) if (detectOverlap(list)) return true;
  return false;
}
