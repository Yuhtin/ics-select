'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import type { ItemResponse } from '../../lib/queries/me-item';
import { useSetItemOutcome } from '../../lib/queries/me-item';
import type { ItemOutcome } from '@ics-select/shared';
import { Eyebrow } from '../ui/eyebrow';
import { Button } from '../ui/button';
import { OutcomePicker } from '../ui/outcome-picker';
import { OutcomeDot } from '../ui/outcome-dot';
import { formatTimeLocal, formatDateLocal } from '../../lib/format/time';
import { GuidedFlow } from './guided-flow';
import { GuidedTextResponse } from './guided-text-response';
import { platformLabel, detectPlatform } from '../../lib/format/platform';

// Outcomes that require the member to report time spent. SKIPPED, STUCK
// and PENDING are excluded — the member either didn't study the item or
// already knew it, so there's no time to report.
const TIME_REQUIRED_OUTCOMES: ReadonlySet<ItemOutcome> = new Set([
  'DONE_EASY',
  'DONE_HARD',
  'DOUBTS',
]);

type OutcomeStep = 'outcome' | 'reflection' | 'time';

interface ItemFocusProps {
  item: ItemResponse;
}

export function ItemFocus({ item }: ItemFocusProps) {
  const isDone = item.outcome !== 'PENDING';
  const [outcome, setOutcome] = useState<ItemOutcome | null>(isDone ? item.outcome : null);
  const [reflection, setReflection] = useState(item.reflection ?? '');
  const [editing, setEditing] = useState(false);
  const [outcomeStep, setOutcomeStep] = useState<OutcomeStep>('outcome');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [saveError, setSaveError] = useState<string | null>(null);
  const flowId = useId();
  const headingId = `${flowId}-${outcomeStep}`;
  const [actualMinutesInput, setActualMinutesInput] = useState('');

  const mutation = useSetItemOutcome();

  const now = new Date();
  const platform = detectPlatform(item.libraryItem.url, item.libraryItem.format);

  // "Running late" means the scheduled window has ENDED and the member hasn't
  // marked the item yet — not that the session just started.
  const scheduledEnd =
    item.scheduledAt && item.scheduledMinutes
      ? new Date(
          new Date(item.scheduledAt).getTime() + item.scheduledMinutes * 60_000,
        )
      : item.scheduledAt
        ? new Date(item.scheduledAt)
        : null;
  const isRunningLate = !isDone && scheduledEnd !== null && scheduledEnd < now;

  const eyebrowText = (() => {
    if (isDone && item.completedAt) return `Marked · ${formatDateLocal(item.completedAt)}`;
    if (item.scheduledAt) {
      if (!isRunningLate) return `Scheduled · ${formatDateLocal(item.scheduledAt)} ${formatTimeLocal(item.scheduledAt)}`;
      return `Running late · was at ${formatTimeLocal(item.scheduledAt)}`;
    }
    return 'Pending';
  })();

  const eyebrowClass = isRunningLate ? '!text-fg' : isDone ? '' : '!text-primary dark:!text-primary-fg';

  const requiresTime = outcome !== null && TIME_REQUIRED_OUTCOMES.has(outcome);
  const parsedMinutes = (() => {
    const trimmed = actualMinutesInput.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
    if (n < 1 || n > 1440) return null;
    return n;
  })();
  const canSave =
    outcome !== null && (!requiresTime || parsedMinutes !== null);

  const outcomeSteps: OutcomeStep[] = outcome === null ? ['outcome'] : [
    'outcome',
    ...(outcome !== 'PENDING' && outcome !== 'SKIPPED' ? ['reflection' as const] : []),
    ...(requiresTime ? ['time' as const] : []),
  ];
  const stepIndex = outcomeSteps.indexOf(outcomeStep);
  const finalStep = stepIndex === outcomeSteps.length - 1;
  const heading = outcomeStep === 'outcome' ? 'How did it go?' : outcomeStep === 'reflection' ? 'Sua nota' : 'Tempo gasto (min)';

  function openEditor() {
    setOutcomeStep('outcome');
    setDirection(1);
    setEditing(true);
  }

  function handleSave() {
    if (!outcome || !canSave || mutation.isPending) return;
    setSaveError(null);
    mutation.mutate({
      planId: item.planId,
      itemId: item.id,
      outcome,
      reflection: reflection.trim() === '' ? undefined : reflection,
      actualMinutes: requiresTime ? parsedMinutes : null,
    }, {
      onSuccess: () => {
        setActualMinutesInput('');
        setEditing(false);
      },
      onError: (error) => setSaveError(error.message),
    });
  }

  function applyOutcome(o: ItemOutcome) {
    mutation.mutate({ planId: item.planId, itemId: item.id, outcome: o });
  }

  return (
    <div className="max-w-[800px] space-y-8">
      <Link
        href="/me"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-input font-sans text-sm text-fg-mute hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back
      </Link>

      <header
        data-testid="item-focus-header"
        className={clsx(
          'border-b border-l-4 border-border-token pb-7 pl-5',
          isRunningLate ? 'border-l-warn' : isDone ? 'border-l-success' : 'border-l-primary',
        )}
      >
        <Eyebrow className={eyebrowClass}>{eyebrowText}</Eyebrow>
        <h1 className="mt-3 font-sans text-[32px] font-semibold leading-[1.12] tracking-[-0.045em] sm:text-[40px]">
          {item.libraryItem.title}
        </h1>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-sans text-xs text-fg-mute">
          <span>{platformLabel(platform)}</span>
          <span>{item.libraryItem.estimatedMinutes} min</span>
          {item.libraryItem.topic && <span>{item.libraryItem.topic.label}</span>}
        </p>
      </header>

      {item.libraryItem.url && (
        <a
          href={item.libraryItem.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-input bg-primary px-6 text-sm font-semibold text-primary-fg hover:bg-primary/90 md:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Open on {platformLabel(platform)}
          <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
        </a>
      )}

      {item.libraryItem.description && (
        <section>
          <Eyebrow>About this study</Eyebrow>
          <p className="mt-2 font-sans text-base text-fg-soft leading-relaxed">
            {item.libraryItem.description}
          </p>
        </section>
      )}

      {item.carriedFrom && (
        <section className="border-l-2 border-reflect pl-5">
          <Eyebrow className="!text-accent">Carried from last week · your note</Eyebrow>
          {item.carriedFrom.reflection ? (
            <p className="mt-2 font-sans leading-relaxed text-fg-soft">&ldquo;{item.carriedFrom.reflection}&rdquo;</p>
          ) : (
            <p className="mt-2 font-sans text-sm text-fg-mute">(no reflection on the previous attempt)</p>
          )}
          <p className="mt-2 font-sans text-sm text-fg-mute">
            Marked {item.carriedFrom.outcome.replace('_', ' ')} · week of {item.carriedFrom.weekStart}
          </p>
        </section>
      )}

      <section>
        {editing ? (
          <>
            <GuidedFlow
              stepKey={outcomeStep}
              headingId={headingId}
              index={stepIndex}
              total={outcomeSteps.length}
              direction={direction}
              title={heading}
              canContinue={finalStep ? canSave : outcome !== null}
              final={finalStep}
              submitLabel="Save outcome"
              submittingLabel="Saving…"
              submitting={mutation.isPending}
              exitLabel="Exit outcome editor"
              onExit={() => setEditing(false)}
              onPrevious={() => {
                setDirection(-1);
                setOutcomeStep(outcomeSteps[stepIndex - 1]);
              }}
              onContinue={() => {
                setDirection(1);
                setOutcomeStep(outcomeSteps[stepIndex + 1]);
              }}
              onSubmit={handleSave}
            >
              <fieldset disabled={mutation.isPending} className="min-w-0">
                {outcomeStep === 'outcome' && (
                  <OutcomePicker
                    presentation="guided"
                    value={outcome}
                    onChange={(value) => { setOutcome(value); setSaveError(null); }}
                    disabled={mutation.isPending}
                    showSkip={item.skippable && (item.outcome === 'PENDING' || outcome === 'SKIPPED')}
                  />
                )}
                {outcomeStep === 'reflection' && (
                  <GuidedTextResponse
                    id={`${flowId}-reflection`}
                    labelledBy={headingId}
                    value={reflection}
                    onChange={(value) => { setReflection(value); setSaveError(null); }}
                    placeholder="Escreve em pt-BR se quiser — é sua nota"
                  />
                )}
                {outcomeStep === 'time' && (
                  <div className="space-y-3">
                    <input
                      aria-labelledby={headingId}
                      aria-invalid={actualMinutesInput.trim() !== '' && parsedMinutes === null || undefined}
                      aria-describedby={actualMinutesInput.trim() !== '' && parsedMinutes === null ? `${flowId}-time-error` : undefined}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={1440}
                      step={1}
                      value={actualMinutesInput}
                      onChange={(event) => { setActualMinutesInput(event.target.value); setSaveError(null); }}
                      placeholder="Ex: 45"
                      className="min-h-14 w-full max-w-48 rounded-none border-0 border-b-2 border-border-strong bg-transparent px-0 font-mono text-3xl tabular-nums text-fg outline-none placeholder:text-fg-mute focus:border-primary focus:ring-0"
                    />
                    {actualMinutesInput.trim() !== '' && parsedMinutes === null && (
                      <p id={`${flowId}-time-error`} role="alert" className="font-sans text-xs text-outcome-stuck">
                        Use um número inteiro entre 1 e 1440.
                      </p>
                    )}
                  </div>
                )}
              </fieldset>
            </GuidedFlow>
            {saveError && <p role="alert" className="font-sans text-sm text-danger">{saveError}</p>}
          </>
        ) : item.outcome === 'PENDING' ? (
          <Button variant="ghost" onClick={openEditor} className="w-full">How did it go?</Button>
        ) : item.outcome === 'SKIPPED' ? (
          <div className="flex flex-wrap items-center gap-2 text-outcome-skipped">
            <OutcomeDot outcome="SKIPPED" size="sm" />
            <span className="text-sm font-semibold">Already known</span>
            <button
              type="button"
              onClick={async () => {
                await applyOutcome('PENDING');
                setOutcome(null);
                openEditor();
              }}
              className="min-h-11 rounded-input px-2 text-xs underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Undo
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Eyebrow>How did it go?</Eyebrow>
            <p className="font-sans text-sm text-fg">
              {item.outcome.replace('_', ' ')}
            </p>
            {item.reflection && (
              <p className="font-sans leading-relaxed text-fg-soft">&ldquo;{item.reflection}&rdquo;</p>
            )}
            <Button variant="ghost" onClick={openEditor}>
              Edit
            </Button>
          </div>
        )}
      </section>

      {item.outcome === 'STUCK' && (
        <aside className="border-l-2 border-danger pl-5">
          <p className="font-mono text-[10px] uppercase tracking-eyebrow font-semibold text-outcome-stuck">
            Stuck — help requested
          </p>
          <p className="mt-1 font-sans text-sm text-fg-soft">
            The program director has been notified. Talk to them when you can.
          </p>
        </aside>
      )}
    </div>
  );
}
