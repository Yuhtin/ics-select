'use client';
import { useMemo } from 'react';
import { X, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { minutesToHHMM, hhmmToMinutes, thirtyMinuteGrid } from '../../lib/format/time';
import type { AvailabilitySlot } from '../../lib/queries/me-settings';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Props = {
  slots: AvailabilitySlot[];
  onChange: (next: AvailabilitySlot[]) => void;
};

export function AvailabilitySlotEditor({ slots, onChange }: Props) {
  const grid = useMemo(thirtyMinuteGrid, []);

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
    const start = Math.min(lastEnd, 22 * 60);
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
    const next = existing.map((s, i) => (i === idx ? { ...s, ...patch } : s));
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
              'rounded-input border bg-surface px-3 py-2.5',
              overlap ? 'border-outcome-stuck' : 'border-border-token',
            )}
          >
            <div className="flex items-center gap-3">
              <span className="w-14 font-mono text-[11px] font-semibold uppercase tracking-eyebrow text-fg-mute">
                {label}
              </span>
              <div className="flex-1 space-y-1.5">
                {daySlots.length === 0 && (
                  <p className="font-sans text-[12px] text-fg-faint">
                    indisponível
                  </p>
                )}
                {daySlots.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={minutesToHHMM(s.startMinute)}
                      onChange={(e) => updateSlot(day, idx, { startMinute: hhmmToMinutes(e.target.value) })}
                      className="rounded-input border border-border-token bg-surface px-2 py-0.5 font-mono text-[12px] text-fg focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label={`${label} start`}
                    >
                      {grid.slice(0, -1).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <span className="font-sans text-[12px] text-fg-mute">–</span>
                    <select
                      value={minutesToHHMM(s.endMinute)}
                      onChange={(e) => updateSlot(day, idx, { endMinute: hhmmToMinutes(e.target.value) })}
                      className="rounded-input border border-border-token bg-surface px-2 py-0.5 font-mono text-[12px] text-fg focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label={`${label} end`}
                    >
                      {grid.slice(1).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeSlot(day, idx)}
                      className="rounded-pill border border-transparent p-0.5 text-fg-mute hover:border-border-token hover:text-fg"
                      aria-label={`Remove ${label} slot ${idx + 1}`}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSlot(day)}
                  className="flex items-center gap-1 font-sans text-[12px] text-fg-mute hover:text-fg"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  adicionar faixa
                </button>
              </div>
            </div>
            {overlap && (
              <p className="mt-1.5 pl-[68px] font-mono text-[11px] text-outcome-stuck">
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
