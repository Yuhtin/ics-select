'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import type { ItemResponse } from '../../lib/queries/me-item';
import { useSetItemOutcome } from '../../lib/queries/me-item';
import type { ItemOutcome } from '@ics-select/shared';
import { Eyebrow } from '../ui/eyebrow';
import { Pill } from '../ui/pill';
import { Button } from '../ui/button';
import { OutcomePicker } from '../ui/outcome-picker';
import { OutcomeDot } from '../ui/outcome-dot';
import { formatTimeLocal, formatDateLocal } from '../../lib/format/time';
import { platformLabel, detectPlatform, type PlatformKey } from '../../lib/format/platform';

const TIME_CHIPS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1h',     value: 60 },
  { label: '1h30',   value: 90 },
  { label: '2h+',    value: 120 },
  { label: 'Não sei', value: null },
] as const;

const PLATFORM_STRIPE: Record<PlatformKey, string> = {
  leetcode: 'bg-platform-leetcode',
  youtube: 'bg-platform-youtube',
  medium: 'bg-platform-medium',
  github: 'bg-platform-github',
  article: 'bg-platform-article',
  book: 'bg-platform-book',
};

interface ItemFocusProps {
  item: ItemResponse;
}

export function ItemFocus({ item }: ItemFocusProps) {
  const isDone = item.outcome !== 'PENDING';
  const [outcome, setOutcome] = useState<ItemOutcome | null>(isDone ? item.outcome : null);
  const [reflection, setReflection] = useState(item.reflection ?? '');
  const [editing, setEditing] = useState(!isDone);
  const [actualMinutes, setActualMinutes] = useState<number | null | undefined>(undefined);

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

  const eyebrowClass = isRunningLate ? '!text-outcome-stuck' : '';

  function handleSave() {
    if (!outcome) return;
    // Optimistic update flips the cache immediately, so we can close the form
    // synchronously instead of awaiting the slow backend round-trip.
    mutation.mutate({
      planId: item.planId,
      itemId: item.id,
      outcome,
      reflection: reflection.trim() === '' ? undefined : reflection,
      actualMinutes: actualMinutes === undefined ? null : actualMinutes,
    });
    setActualMinutes(undefined);
    setEditing(false);
  }

  function applyOutcome(o: ItemOutcome) {
    mutation.mutate({ planId: item.planId, itemId: item.id, outcome: o });
  }

  return (
    <div className="max-w-3xl space-y-8">
      <Link
        href="/me"
        className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-label text-ink-mute hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back
      </Link>

      <header
        className={clsx(
          'relative pl-4 md:pl-5',
          isRunningLate && 'border-l-[3px] border-outcome-stuck',
        )}
      >
        {!isRunningLate && (
          <span
            aria-hidden
            className={clsx(
              'absolute left-0 top-1 bottom-1 w-[3px] rounded-[2px]',
              PLATFORM_STRIPE[platform],
            )}
          />
        )}
        <Eyebrow className={eyebrowClass}>{eyebrowText}</Eyebrow>
        <h1 className="mt-3 font-serif text-[40px] font-medium leading-[1.05] tracking-tight md:text-[48px]">
          {item.libraryItem.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs text-ink-mute">
          <span className="uppercase tracking-label text-ink-soft">{platformLabel(platform)}</span>
          <span aria-hidden>·</span>
          <span>{item.libraryItem.estimatedMinutes} min</span>
          {item.libraryItem.topic && (
            <>
              <span aria-hidden>·</span>
              <span className="uppercase tracking-label">{item.libraryItem.topic.label}</span>
            </>
          )}
        </div>
      </header>

      {item.libraryItem.url && (
        <a
          href={item.libraryItem.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-ink px-6 text-sm font-semibold text-paper hover:bg-ink-soft md:w-auto"
        >
          Open on {platformLabel(platform)}
          <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
        </a>
      )}

      {item.libraryItem.description && (
        <section>
          <Eyebrow>About this study</Eyebrow>
          <p className="mt-2 font-sans text-base text-ink-soft leading-relaxed">
            {item.libraryItem.description}
          </p>
        </section>
      )}

      {item.carriedFrom && (
        <section className="border-l-4 border-accent pl-5 md:pl-6">
          <Eyebrow className="!text-accent">Carried from last week · your note</Eyebrow>
          {item.carriedFrom.reflection ? (
            <p className="mt-2 font-serif italic text-ink-soft">&ldquo;{item.carriedFrom.reflection}&rdquo;</p>
          ) : (
            <p className="mt-2 font-sans text-sm text-ink-mute">(no reflection on the previous attempt)</p>
          )}
          <p className="mt-2 font-mono text-xs uppercase tracking-label text-ink-mute">
            Marked {item.carriedFrom.outcome.replace('_', ' ')} · week of {item.carriedFrom.weekStart}
          </p>
        </section>
      )}

      <section>
        <Eyebrow>How did it go?</Eyebrow>
        {editing ? (
          <div className="mt-3 space-y-4">
            <OutcomePicker
              value={outcome}
              onChange={setOutcome}
              showSkip={item.skippable && item.outcome === 'PENDING'}
            />
            {outcome && outcome !== 'PENDING' && outcome !== 'SKIPPED' && (
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="Escreve em pt-BR se quiser — é sua nota"
                className="w-full min-h-[96px] rounded-input border border-rule bg-surface p-3 font-sans text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ink"
              />
            )}
            {outcome && outcome !== 'PENDING' && outcome !== 'SKIPPED' && (
              <div className="space-y-2">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">Tempo gasto (opcional)</p>
                <div className="flex flex-wrap gap-2">
                  {TIME_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => setActualMinutes(chip.value)}
                      className={clsx(
                        'font-mono text-[11px] uppercase tracking-[0.1em] px-3 py-1.5 rounded-pill border transition-colors',
                        actualMinutes === chip.value
                          ? 'bg-ink text-paper border-ink'
                          : 'bg-paper-warm text-ink-soft border-rule hover:bg-rule',
                      )}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Button
              onClick={handleSave}
              disabled={!outcome || mutation.isPending}
            >
              {mutation.isPending ? 'Saving…' : 'Save outcome'}
            </Button>
          </div>
        ) : item.outcome === 'SKIPPED' ? (
          <div className="mt-3 flex items-center gap-2 text-outcome-skipped">
            <OutcomeDot outcome="SKIPPED" size="sm" />
            <span className="text-sm font-semibold">Already known</span>
            <button
              type="button"
              onClick={async () => {
                await applyOutcome('PENDING');
                setOutcome(null);
                setEditing(true);
              }}
              className="text-xs underline"
            >
              Undo
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="font-mono text-xs uppercase tracking-label text-ink">
              {item.outcome.replace('_', ' ')}
            </p>
            {item.reflection && (
              <p className="font-serif italic text-ink-soft">&ldquo;{item.reflection}&rdquo;</p>
            )}
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        )}
      </section>

      {item.outcome === 'STUCK' && (
        <aside className="border-l-4 border-outcome-stuck pl-5 py-2 md:pl-6">
          <p className="font-mono text-[10px] uppercase tracking-eyebrow font-semibold text-outcome-stuck">
            Stuck — help requested
          </p>
          <p className="mt-1 font-sans text-sm text-ink-soft">
            The program director has been notified. Talk to them when you can.
          </p>
        </aside>
      )}
    </div>
  );
}
