'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ItemResponse } from '../../lib/queries/me-item';
import { useSetItemOutcome } from '../../lib/queries/me-item';
import type { ItemOutcome } from '@ics-select/shared';
import { Eyebrow } from '../ui/eyebrow';
import { Pill } from '../ui/pill';
import { Button } from '../ui/button';
import { OutcomePicker } from '../ui/outcome-picker';
import { formatTimeUtc, formatDateShort } from '../../lib/format/time';
import { platformLabel, detectPlatform } from '../../lib/format/platform';

interface ItemFocusProps {
  item: ItemResponse;
}

export function ItemFocus({ item }: ItemFocusProps) {
  const isDone = item.outcome !== 'PENDING';
  const [outcome, setOutcome] = useState<ItemOutcome | null>(isDone ? item.outcome : null);
  const [reflection, setReflection] = useState(item.reflection ?? '');
  const [editing, setEditing] = useState(!isDone);

  const mutation = useSetItemOutcome();

  const now = new Date();
  const scheduledFuture =
    item.scheduledAt !== null && new Date(item.scheduledAt) > now && item.outcome === 'PENDING';

  const platform = detectPlatform(item.libraryItem.url, item.libraryItem.format);

  const eyebrowText = (() => {
    if (isDone && item.completedAt) return `Marked · ${formatDateShort(item.completedAt)}`;
    if (item.scheduledAt) {
      const sched = new Date(item.scheduledAt);
      if (sched > now) return `Scheduled · ${formatDateShort(item.scheduledAt)} ${formatTimeUtc(item.scheduledAt)}`;
      return `Running late · was at ${formatTimeUtc(item.scheduledAt)}`;
    }
    return 'Pending';
  })();

  async function handleSave() {
    if (!outcome) return;
    await mutation.mutateAsync({
      planId: item.planId,
      itemId: item.id,
      outcome,
      reflection: reflection.trim() === '' ? undefined : reflection,
    });
    setEditing(false);
  }

  return (
    <div className="max-w-3xl space-y-8">
      <Link
        href="/me"
        className="font-mono text-xs uppercase tracking-label text-ink-mute hover:text-ink"
      >
        ← Back
      </Link>

      <header>
        <Eyebrow>{eyebrowText}</Eyebrow>
        <h1 className="mt-3 font-serif text-[40px] font-medium leading-[1.05] tracking-tight">
          {item.libraryItem.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Pill>{platformLabel(platform)}</Pill>
          <span className="font-mono text-xs text-ink-mute">{item.libraryItem.estimatedMinutes} MIN</span>
          {item.libraryItem.topic && <Pill variant="soft">{item.libraryItem.topic.label}</Pill>}
        </div>
      </header>

      {item.libraryItem.url && (
        <a
          href={item.libraryItem.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 w-full items-center justify-center rounded-pill bg-ink px-6 text-sm font-semibold text-paper hover:bg-ink-soft md:w-auto"
        >
          Open on {platformLabel(platform)} ↗
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
        <section className="border-l-2 border-rule pl-4">
          <Eyebrow>Carried from last week · your note</Eyebrow>
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
              disabled={scheduledFuture}
              disabledReason={
                scheduledFuture
                  ? `Available at ${formatTimeUtc(item.scheduledAt)} · don't mark before you start.`
                  : undefined
              }
            />
            {outcome && outcome !== 'PENDING' && (
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="Escreve em pt-BR se quiser — é sua nota"
                className="w-full min-h-[96px] rounded-input border border-rule bg-surface p-3 font-sans text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ink"
              />
            )}
            <Button
              onClick={handleSave}
              disabled={!outcome || mutation.isPending}
            >
              {mutation.isPending ? 'Saving…' : 'Save outcome'}
            </Button>
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
        <p className="font-mono text-xs uppercase tracking-label text-ink-mute">
          The program director has been notified — talk to them when you can.
        </p>
      )}
    </div>
  );
}
