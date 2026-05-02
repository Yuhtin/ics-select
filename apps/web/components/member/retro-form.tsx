'use client';
import { useState } from 'react';
import { Select, SelectItem } from '@heroui/react';
import type { RetroCurrentResponse, WeekRecapItem } from '../../lib/queries/me-retro';
import { useSubmitRetro } from '../../lib/queries/me-retro';
import { Eyebrow } from '../ui/eyebrow';
import { SectionLabel } from '../ui/section-label';
import { Button } from '../ui/button';
import { RetroRecap } from './retro-recap';

interface RetroFormProps {
  data: RetroCurrentResponse;
}

const STUCK_OUTCOMES: ReadonlySet<WeekRecapItem['outcome']> = new Set(['DOUBTS', 'STUCK']);
const VALUED_OUTCOMES: ReadonlySet<WeekRecapItem['outcome']> = new Set(['DONE_EASY', 'DONE_HARD']);

export function RetroForm({ data }: RetroFormProps) {
  const recap = data.weekRecap ?? null;
  const [whatClicked, setWhatClicked]   = useState(data.retro?.whatClicked ?? '');
  const [whatStuck,   setWhatStuck]     = useState(data.retro?.whatStuck   ?? '');
  const [nextWeekWish, setNextWeekWish] = useState(data.retro?.nextWeekWish ?? '');
  const [valuedItemId, setValuedItemId] = useState<string | null>(data.retro?.valuedItemId ?? null);
  const [stuckItemId,  setStuckItemId]  = useState<string | null>(data.retro?.stuckItemId  ?? null);
  const submit = useSubmitRetro();

  const disabled = !data.open;
  const stuckOptions  = recap?.items.filter((i) => STUCK_OUTCOMES.has(i.outcome))  ?? [];
  const valuedOptions = recap?.items.filter((i) => VALUED_OUTCOMES.has(i.outcome)) ?? [];
  // Q1 only renders when there's at least one DOUBTS/STUCK item to anchor against.
  const showStuckQuestion = stuckOptions.length > 0;
  // Q2 renders whenever there is a recap (even if 0 valued items — picker shows "Nenhum" only).
  const showValuedQuestion = recap !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submit.mutateAsync({
      whatClicked: whatClicked.trim() || undefined,
      whatStuck:   whatStuck.trim()   || undefined,
      nextWeekWish: nextWeekWish.trim() || undefined,
      valuedItemId: valuedItemId,
      stuckItemId:  stuckItemId,
    });
  }

  return (
    <form className="max-w-3xl space-y-8" onSubmit={handleSubmit}>
      <header>
        <Eyebrow>Weekly retro</Eyebrow>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">
          How was this week?
        </h1>
        <p className="mt-3 font-sans text-sm text-ink-soft">
          Your notes help shape next week&apos;s plan. Only the program director sees them.
        </p>
        {!data.open && (
          <p className="mt-3 border-l-4 border-outcome-done-hard pl-4 font-mono text-xs uppercase tracking-label text-outcome-done-hard">
            Retro closed — window reopens Fri 18:00 local.
          </p>
        )}
      </header>

      {recap && <RetroRecap recap={recap} />}

      {showStuckQuestion && (
        <fieldset className="space-y-3" disabled={disabled}>
          <SectionLabel>Qual item dessa semana travou ou ficou com dúvida?</SectionLabel>
          <Select
            aria-label="Item travado"
            placeholder="Escolha um item…"
            selectedKeys={stuckItemId ? [stuckItemId] : []}
            onSelectionChange={(keys) => {
              const next = Array.from(keys)[0];
              setStuckItemId(typeof next === 'string' ? next : null);
            }}
          >
            {stuckOptions.map((it) => (
              <SelectItem key={it.id}>{it.title}</SelectItem>
            ))}
          </Select>
          <RetroTextarea
            label="O que falta pra desbloquear?"
            value={whatStuck}
            onChange={setWhatStuck}
            disabled={disabled}
          />
        </fieldset>
      )}

      {showValuedQuestion && (
        <fieldset className="space-y-3" disabled={disabled}>
          <SectionLabel>Qual item dessa semana mais valeu a pena?</SectionLabel>
          <Select
            aria-label="Item que mais valeu a pena"
            placeholder="Escolha um item…"
            selectedKeys={valuedItemId ? [valuedItemId] : ['__none__']}
            onSelectionChange={(keys) => {
              const next = Array.from(keys)[0];
              if (next === '__none__' || typeof next !== 'string') {
                setValuedItemId(null);
              } else {
                setValuedItemId(next);
              }
            }}
          >
            <SelectItem key="__none__">Nenhum</SelectItem>
            <>
              {valuedOptions.map((it) => (
                <SelectItem key={it.id}>{it.title}</SelectItem>
              ))}
            </>
          </Select>
          <RetroTextarea
            label="Por quê?"
            value={whatClicked}
            onChange={setWhatClicked}
            disabled={disabled}
          />
        </fieldset>
      )}

      <fieldset className="space-y-3" disabled={disabled}>
        <SectionLabel>1 coisa que você quer no próximo plano</SectionLabel>
        <textarea
          value={nextWeekWish}
          onChange={(e) => setNextWeekWish(e.target.value)}
          placeholder="ex: 'menos LeetCode, mais system design' / 'item Y específico' / 'só 4 itens, essa semana foi pesada' / 'mais conteúdo em pt-BR'"
          disabled={disabled}
          className="w-full min-h-[120px] rounded-input border border-rule bg-surface p-3 font-sans text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ink disabled:cursor-not-allowed disabled:opacity-60"
        />
      </fieldset>

      <Button type="submit" disabled={disabled || submit.isPending}>
        {submit.isPending ? 'Saving…' : data.retro ? 'Update retro' : 'Submit retro'}
      </Button>
    </form>
  );
}

function RetroTextarea({
  label, value, onChange, disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute mb-2">
        {label}
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full min-h-[100px] rounded-input border border-rule bg-surface p-3 font-sans text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ink disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
}
