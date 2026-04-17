'use client';
import { useState } from 'react';
import type { RetroCurrentResponse } from '../../lib/queries/me-retro';
import { useSubmitRetro } from '../../lib/queries/me-retro';
import { Eyebrow } from '../ui/eyebrow';
import { SectionLabel } from '../ui/section-label';
import { Button } from '../ui/button';

interface RetroFormProps {
  data: RetroCurrentResponse;
}

export function RetroForm({ data }: RetroFormProps) {
  const [whatClicked, setWhatClicked] = useState(data.retro?.whatClicked ?? '');
  const [whatStuck, setWhatStuck] = useState(data.retro?.whatStuck ?? '');
  const [nextWeekWish, setNextWeekWish] = useState(data.retro?.nextWeekWish ?? '');
  const submit = useSubmitRetro();

  const disabled = !data.open;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submit.mutateAsync({
      whatClicked: whatClicked.trim() || undefined,
      whatStuck: whatStuck.trim() || undefined,
      nextWeekWish: nextWeekWish.trim() || undefined,
    });
  }

  return (
    <form className="max-w-3xl space-y-8" onSubmit={handleSubmit}>
      <div>
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
      </div>

      <RetroField
        label="What clicked"
        placeholder="o que fluiu, destravou, te animou"
        value={whatClicked}
        onChange={setWhatClicked}
        disabled={disabled}
      />
      <RetroField
        label="What got stuck"
        placeholder="o que travou, confundiu ou foi chato"
        value={whatStuck}
        onChange={setWhatStuck}
        disabled={disabled}
      />
      <RetroField
        label="Next week, I want"
        placeholder="o que você pediria pro admin"
        value={nextWeekWish}
        onChange={setNextWeekWish}
        disabled={disabled}
      />

      <Button type="submit" disabled={disabled || submit.isPending}>
        {submit.isPending ? 'Saving…' : data.retro ? 'Update retro' : 'Submit retro'}
      </Button>
    </form>
  );
}

function RetroField({
  label, placeholder, value, onChange, disabled,
}: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full min-h-[120px] rounded-input border border-rule bg-surface p-3 font-sans text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ink disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
}
