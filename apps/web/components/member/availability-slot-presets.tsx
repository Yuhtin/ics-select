'use client';
import type { AvailabilitySlot } from '../../lib/queries/me-settings';

type Props = {
  slots: AvailabilitySlot[];
  onChange: (next: AvailabilitySlot[]) => void;
};

export function AvailabilitySlotPresets({ slots, onChange }: Props) {
  function applyWeekdayNight() {
    const additions: AvailabilitySlot[] = [0, 1, 2, 3, 4].map((d) => ({
      dayOfWeek: d,
      startMinute: 19 * 60,
      endMinute: 22 * 60,
    }));
    const kept = slots.filter((s) => !additions.some((a) => a.dayOfWeek === s.dayOfWeek));
    onChange([...kept, ...additions]);
  }

  function applyWeekendMorning() {
    const additions: AvailabilitySlot[] = [5, 6].map((d) => ({
      dayOfWeek: d,
      startMinute: 8 * 60,
      endMinute: 12 * 60,
    }));
    const kept = slots.filter((s) => !additions.some((a) => a.dayOfWeek === s.dayOfWeek));
    onChange([...kept, ...additions]);
  }

  function copyMondayToAll() {
    const mondaySlots = slots.filter((s) => s.dayOfWeek === 0);
    if (mondaySlots.length === 0) return;
    const replicated: AvailabilitySlot[] = [];
    for (let d = 1; d < 7; d++) {
      for (const s of mondaySlots) {
        replicated.push({ dayOfWeek: d, startMinute: s.startMinute, endMinute: s.endMinute });
      }
    }
    onChange([...mondaySlots, ...replicated]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <PresetButton onClick={applyWeekdayNight}>Noite de semana</PresetButton>
      <PresetButton onClick={applyWeekendMorning}>Manhã de fim de semana</PresetButton>
      <PresetButton onClick={copyMondayToAll}>Copiar Seg pra todos</PresetButton>
    </div>
  );
}

function PresetButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-pill border border-border-token bg-surface px-3 py-1 font-sans text-[12px] text-fg-soft hover:border-border-strong hover:text-fg"
    >
      {children}
    </button>
  );
}
