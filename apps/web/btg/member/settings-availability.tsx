'use client';

import { useEffect, useState } from 'react';
import {
  useMeAvailability,
  useUpdateAvailability,
  type AvailabilityResponse,
  type AvailabilitySlot,
} from '../../lib/queries/me-settings';
import { useAutoSaveField } from '../../lib/forms/use-auto-save-field';
import { Icon, Loading } from '../ui';
import { DAYS, DayCaps, SessionLength, type DayMinutes } from './member-extra-fields';
import { Section, useOverlapFlag } from './settings';

const DEFAULTS: AvailabilityResponse = {
  mondayMinutes: null,
  tuesdayMinutes: null,
  wednesdayMinutes: null,
  thursdayMinutes: null,
  fridayMinutes: null,
  saturdayMinutes: null,
  sundayMinutes: null,
  preferredSessionMinutes: 30,
  timezone: 'America/Sao_Paulo',
  calendarBusy: true,
  slots: [],
};

const END = 24 * 60;
const HALF_HOURS = Array.from({ length: 49 }, (_, i) => i * 30); // 00:00 … 24:00
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function dayOverlaps(list: AvailabilitySlot[]): boolean {
  const sorted = [...list].sort((a, b) => a.startMinute - b.startMinute);
  return sorted.some((s, i) => s.endMinute <= s.startMinute || (i > 0 && s.startMinute < sorted[i - 1]!.endMinute));
}
const anyOverlap = (slots: AvailabilitySlot[]) =>
  [0, 1, 2, 3, 4, 5, 6].some((d) => dayOverlaps(slots.filter((s) => s.dayOfWeek === d)));

function SlotEditor({ slots, onChange }: { slots: AvailabilitySlot[]; onChange: (s: AvailabilitySlot[]) => void }) {
  const dayList = (d: number) => slots.filter((s) => s.dayOfWeek === d).sort((a, b) => a.startMinute - b.startMinute);
  const setDay = (d: number, next: AvailabilitySlot[]) => onChange([...slots.filter((s) => s.dayOfWeek !== d), ...next]);

  function add(d: number) {
    const list = dayList(d);
    const start = list.length > 0 ? list[list.length - 1]!.endMinute : 18 * 60;
    if (start >= END - 30) return; // no room for a 30-min slot
    setDay(d, [...list, { dayOfWeek: d, startMinute: start, endMinute: Math.min(start + 120, END) }]);
  }
  function patch(d: number, idx: number, p: Partial<AvailabilitySlot>) {
    setDay(
      d,
      dayList(d).map((s, i) => {
        if (i !== idx) return s;
        const m = { ...s, ...p };
        if (m.endMinute <= m.startMinute) m.endMinute = Math.min(m.startMinute + 30, END);
        return m;
      }),
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {DAYS.map((day, d) => {
        const list = dayList(d);
        const overlap = dayOverlaps(list);
        return (
          <div key={day.key} className="btg-mx-dayrow" style={overlap ? { borderColor: 'var(--btg-stuck)' } : undefined}>
            <span className="btg-eyebrow btg-mx-daylabel">{day.short}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexGrow: 1, minWidth: 0 }}>
              {list.length === 0 && <span className="btg-mute" style={{ fontSize: 14 }}>Indisponível</span>}
              {list.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    className="btg-select btg-mono btg-mx-time"
                    aria-label={`${day.short}: início da faixa ${i + 1}`}
                    value={s.startMinute}
                    onChange={(e) => patch(d, i, { startMinute: Number(e.target.value) })}
                  >
                    {HALF_HOURS.filter((m) => m < END).map((m) => (
                      <option key={m} value={m}>{hhmm(m)}</option>
                    ))}
                  </select>
                  <span className="btg-mute">–</span>
                  <select
                    className="btg-select btg-mono btg-mx-time"
                    aria-label={`${day.short}: fim da faixa ${i + 1}`}
                    value={s.endMinute}
                    onChange={(e) => patch(d, i, { endMinute: Number(e.target.value) })}
                  >
                    {HALF_HOURS.filter((m) => m > s.startMinute).map((m) => (
                      <option key={m} value={m}>{hhmm(m)}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btg-icon-btn"
                    aria-label={`Remover faixa ${i + 1} de ${day.short}`}
                    onClick={() => setDay(d, list.filter((_, j) => j !== i))}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              ))}
              <button type="button" className="btg-btn btg-btn--ghost btg-mx-add" onClick={() => add(d)}>
                <Icon name="add" style={{ fontSize: 18 }} />
                Adicionar faixa
              </button>
              {overlap && (
                <span className="btg-mono" style={{ color: 'var(--btg-stuck)', fontSize: 12 }}>
                  Faixas se sobrepõem. Ajuste para salvar.
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function slotPresets(slots: AvailabilitySlot[]) {
  const replace = (additions: AvailabilitySlot[]) => [
    ...slots.filter((s) => !additions.some((a) => a.dayOfWeek === s.dayOfWeek)),
    ...additions,
  ];
  const monday = slots.filter((s) => s.dayOfWeek === 0);
  return [
    {
      label: 'Noites de semana',
      apply: () => replace([0, 1, 2, 3, 4].map((d) => ({ dayOfWeek: d, startMinute: 19 * 60, endMinute: 22 * 60 }))),
    },
    {
      label: 'Manhãs de fim de semana',
      apply: () => replace([5, 6].map((d) => ({ dayOfWeek: d, startMinute: 8 * 60, endMinute: 12 * 60 }))),
    },
    {
      label: 'Copiar segunda para todos',
      apply: () =>
        monday.length === 0
          ? null
          : [...monday, ...[1, 2, 3, 4, 5, 6].flatMap((d) => monday.map((s) => ({ ...s, id: undefined, dayOfWeek: d })))],
    },
  ];
}

function AvailabilityForm({ initial }: { initial: AvailabilityResponse | undefined }) {
  const [form, setForm] = useState<AvailabilityResponse>({ ...DEFAULTS, ...(initial ?? {}) });
  const update = useUpdateAvailability();
  const { setOverlap } = useOverlapFlag();
  const overlap = anyOverlap(form.slots);

  useEffect(() => {
    setOverlap(overlap);
    return () => setOverlap(false);
  }, [overlap, setOverlap]);

  // Every change saves the whole form, like the classic AvailabilityGrid.
  function apply(patch: Partial<AvailabilityResponse>) {
    const next = { ...form, ...patch };
    setForm(next);
    if (anyOverlap(next.slots)) return;
    const { slots, ...rest } = next;
    update.mutate({
      ...rest,
      slots: slots.map(({ dayOfWeek, startMinute, endMinute }) => ({ dayOfWeek, startMinute, endMinute })),
      clearDays: [0, 1, 2, 3, 4, 5, 6],
    });
  }

  const tz = useAutoSaveField<string>({
    initial: form.timezone,
    debounceMs: 800,
    validate: (v) => v.trim().length > 0,
    save: (v) => apply({ timezone: v }),
  });

  const caps: DayMinutes = Object.fromEntries(DAYS.map((d) => [d.key, form[d.key]])) as DayMinutes;

  return (
    <div className="btg-stack">
      <Section title="Bloquear agenda como ocupado">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <span className="btg-soft" style={{ fontSize: 14 }}>
            {form.calendarBusy
              ? 'Seus blocos de estudo aparecem como Ocupado. Quem marcar reunião com você vê o horário bloqueado.'
              : 'Seus blocos aparecem como Livre. Mentores e colegas podem marcar 1:1 por cima do estudo.'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={form.calendarBusy}
            aria-label="Bloquear agenda como ocupado"
            className="btg-mx-switch"
            onClick={() => apply({ calendarBusy: !form.calendarBusy })}
          >
            <span />
          </button>
        </div>
      </Section>

      <Section
        title="Faixas disponíveis"
        hint={
          <>
            Quando você pode estudar em cada dia. Dia vazio = sem estudo. Passa da meia-noite? Divida em duas, por
            exemplo <span className="btg-mono">Seg 22:00–24:00</span> e <span className="btg-mono">Ter 00:00–05:00</span>.
          </>
        }
      >
        <div className="btg-mx-chips">
          {slotPresets(form.slots).map((p) => (
            <button
              key={p.label}
              type="button"
              className="btg-mx-chip"
              onClick={() => {
                const next = p.apply();
                if (next) apply({ slots: next });
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <SlotEditor slots={form.slots} onChange={(slots) => apply({ slots })} />
      </Section>

      <Section
        title="Limite diário (opcional)"
        hint={<>Teto de minutos de estudo por dia. Escolha <span className="btg-mono">—</span> para usar todas as faixas do dia.</>}
      >
        <DayCaps value={caps} onChange={(next) => apply(next)} />
      </Section>

      <Section title="Duração ideal da sessão" hint="Bloco sem interrupção. O agendador divide os itens em partes desse tamanho.">
        <SessionLength value={form.preferredSessionMinutes} onChange={(m) => apply({ preferredSessionMinutes: m })} />
      </Section>

      <Section title="Fuso horário">
        <input
          className="btg-input btg-mono"
          style={{ maxWidth: 320 }}
          aria-label="Fuso horário"
          value={tz.value}
          placeholder="America/Sao_Paulo"
          onChange={(e) => tz.onChange(e.target.value)}
          onBlur={tz.onBlur}
        />
      </Section>
    </div>
  );
}

export function BtgAvailability() {
  const { data, isLoading } = useMeAvailability();
  if (isLoading) return <Loading />;
  return <AvailabilityForm initial={data} />;
}
