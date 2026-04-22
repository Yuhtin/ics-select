'use client';

import type { ItemOutcome } from '@ics-select/shared';
import { useState } from 'react';
import clsx from 'clsx';
import { ExternalLink } from 'lucide-react';
import type { HomeResponse, HomeItem } from '../../../lib/queries/me-home';
import type { ItemResponse } from '../../../lib/queries/me-item';
import { HomeHero } from '../../../components/member/home-hero';
import { DayList } from '../../../components/member/day-list';
import { StreakCard } from '../../../components/ui/streak-card';
import { Eyebrow } from '../../../components/ui/eyebrow';
import { SectionLabel } from '../../../components/ui/section-label';
import { OutcomePicker } from '../../../components/ui/outcome-picker';
import { Button } from '../../../components/ui/button';
import { formatTimeLocal } from '../../../lib/format/time';
import { detectPlatform, platformLabel, type PlatformKey } from '../../../lib/format/platform';

const PLATFORM_STRIPE_DEV: Record<PlatformKey, string> = {
  leetcode: 'bg-platform-leetcode',
  youtube: 'bg-platform-youtube',
  medium: 'bg-platform-medium',
  github: 'bg-platform-github',
  article: 'bg-platform-article',
  book: 'bg-platform-book',
};

// Fake "now" so scheduledAt comparisons produce the intended intents.
const NOW = new Date('2026-04-17T19:00:00Z');

const baseItem: HomeItem = {
  id: 'i-binary-search',
  planId: 'plan-1',
  order: 2,
  title: 'Binary search patterns',
  format: 'PROBLEM',
  estimatedMinutes: 45,
  url: 'https://leetcode.com/problems/binary-search',
  topic: { slug: 'binary-search', label: 'Binary Search' },
  outcome: 'PENDING',
  skippable: false,
  scheduledAt: '2026-04-17T21:00:00Z', // future today → up_next
  scheduledMinutes: 45,
  carriedFromItemId: null,
};

const doneMorning: HomeItem = {
  id: 'i-recursion',
  planId: 'plan-1',
  order: 1,
  title: 'Recursion intro',
  format: 'VIDEO',
  estimatedMinutes: 30,
  url: 'https://youtube.com/watch?v=x',
  topic: { slug: 'recursion', label: 'Recursion' },
  outcome: 'DONE_EASY',
  skippable: false,
  scheduledAt: '2026-04-17T13:00:00Z',
  scheduledMinutes: 30,
  carriedFromItemId: null,
};

const lateEarlier: HomeItem = {
  id: 'i-complexity',
  planId: 'plan-1',
  order: 3,
  title: 'Complexity review — big-O in practice',
  format: 'ARTICLE',
  estimatedMinutes: 20,
  url: 'https://medium.com/foo',
  topic: { slug: 'complexity', label: 'Complexity' },
  outcome: 'PENDING',
  skippable: false,
  scheduledAt: '2026-04-17T16:00:00Z', // past → late
  scheduledMinutes: 20,
  carriedFromItemId: null,
};

const carriedItem: HomeItem = {
  id: 'i-dp-intro',
  planId: 'plan-1',
  order: 4,
  title: 'DP intro — revisit',
  format: 'PROBLEM',
  estimatedMinutes: 45,
  url: 'https://leetcode.com/problems/dp',
  topic: { slug: 'dp', label: 'Dynamic Programming' },
  outcome: 'PENDING',
  skippable: false,
  scheduledAt: '2026-04-17T22:30:00Z',
  scheduledMinutes: 45,
  carriedFromItemId: 'prev-item-id', // → carried intent
};

const tomorrow: HomeResponse['days'][number] = {
  label: 'Sat, Apr 18',
  date: '2026-04-18',
  items: [
    {
      id: 'i-hash',
      planId: 'plan-1',
      order: 5,
      title: 'Hash table patterns',
      format: 'PROBLEM',
      estimatedMinutes: 45,
      url: 'https://leetcode.com/problems/two-sum',
      topic: { slug: 'hashing', label: 'Hashing' },
      outcome: 'PENDING',
      skippable: false,
      scheduledAt: '2026-04-18T09:00:00Z',
      scheduledMinutes: 45,
      carriedFromItemId: null,
    },
    {
      id: 'i-lc-med',
      planId: 'plan-1',
      order: 6,
      title: 'LeetCode #45 — Jump Game II',
      format: 'PROBLEM',
      estimatedMinutes: 45,
      url: 'https://leetcode.com/problems/jump-game-ii',
      topic: { slug: 'greedy', label: 'Greedy' },
      outcome: 'PENDING',
      skippable: false,
      scheduledAt: '2026-04-18T19:00:00Z',
      scheduledMinutes: 45,
      carriedFromItemId: null,
    },
  ],
};

const sunday: HomeResponse['days'][number] = {
  label: 'Sun, Apr 19',
  date: '2026-04-19',
  items: [
    {
      id: 'i-wrap',
      planId: 'plan-1',
      order: 7,
      title: 'Weekly wrap-up',
      format: 'ARTICLE',
      estimatedMinutes: 20,
      url: null,
      topic: null,
      outcome: 'PENDING',
      skippable: false,
      scheduledAt: '2026-04-19T14:00:00Z',
      scheduledMinutes: 20,
      carriedFromItemId: null,
    },
  ],
};

const sampleItem: ItemResponse = {
  id: baseItem.id,
  planId: baseItem.planId,
  order: baseItem.order,
  outcome: 'PENDING',
  skippable: false,
  reflection: null,
  completedAt: null,
  scheduledAt: baseItem.scheduledAt,
  scheduledMinutes: baseItem.scheduledMinutes,
  libraryItem: {
    id: 'lib-1',
    title: baseItem.title,
    description:
      'Walk through three common variants of binary search — classic, lower-bound, and upper-bound — and apply each to a short LeetCode set.',
    url: baseItem.url,
    format: baseItem.format,
    estimatedMinutes: baseItem.estimatedMinutes,
    topic: baseItem.topic,
  },
  carriedFrom: {
    outcome: 'STUCK',
    reflection: 'Travei no passo de busca com duplicatas — não entendi o invariante do lower-bound.',
    completedAt: '2026-04-11T12:00:00Z',
    weekStart: '2026-04-06',
  },
};

const stuckItem: ItemResponse = {
  ...sampleItem,
  id: 'i-stuck-sample',
  outcome: 'STUCK',
  reflection: 'Não consegui entender recorrência do problema 2 — vou revisar com você na quinta.',
  completedAt: '2026-04-17T20:30:00Z',
  carriedFrom: null,
};

function PreviewFrame({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-rule pt-8">
      <SectionLabel>{label}</SectionLabel>
      {description && (
        <p className="mt-1 mb-6 font-sans text-sm text-ink-soft">{description}</p>
      )}
      <div className="rounded-card border border-rule bg-surface p-8">{children}</div>
    </section>
  );
}

function ItemFocusReadonly({ item, outcomeMode }: { item: ItemResponse; outcomeMode: 'pick' | 'done' }) {
  const [pickedOutcome, setPickedOutcome] = useState<ItemOutcome | null>(null);
  const [reflection, setReflection] = useState('');
  const platform = detectPlatform(item.libraryItem.url, item.libraryItem.format);

  const now = NOW;
  const isDone = item.outcome !== 'PENDING';
  const isRunningLate =
    !isDone && item.scheduledAt !== null && new Date(item.scheduledAt) < now;

  const eyebrowText = (() => {
    if (isDone && item.completedAt)
      return `Marked · ${new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(item.completedAt))}`;
    if (item.scheduledAt) {
      const sched = new Date(item.scheduledAt);
      if (sched > now)
        return `Scheduled · ${new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(sched)} ${formatTimeLocal(item.scheduledAt)}`;
      return `Running late · was at ${formatTimeLocal(item.scheduledAt)}`;
    }
    return 'Pending';
  })();
  const eyebrowClass = isRunningLate ? '!text-outcome-stuck' : '';

  return (
    <div className="max-w-3xl space-y-8">
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
              PLATFORM_STRIPE_DEV[platform],
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
        {outcomeMode === 'pick' ? (
          <div className="mt-3 space-y-4">
            <OutcomePicker value={pickedOutcome} onChange={setPickedOutcome} />
            {pickedOutcome && pickedOutcome !== 'PENDING' && (
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="Escreve em pt-BR se quiser — é sua nota"
                className="w-full min-h-[96px] rounded-input border border-rule bg-surface p-3 font-sans text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ink"
              />
            )}
            <Button disabled={!pickedOutcome}>Save outcome</Button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="font-mono text-xs uppercase tracking-label text-ink">
              {item.outcome.replace('_', ' ')}
            </p>
            {item.reflection && (
              <p className="font-serif italic text-ink-soft">&ldquo;{item.reflection}&rdquo;</p>
            )}
            <Button variant="ghost">Edit</Button>
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

export default function MePreviewPage() {
  const todayItems = [doneMorning, lateEarlier, baseItem, carriedItem];

  return (
    <div className="mx-auto max-w-5xl space-y-16 px-6 py-12">
      <header>
        <Eyebrow>Dev · Me preview</Eyebrow>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight">
          Member experience sandbox
        </h1>
        <p className="mt-3 font-sans text-sm text-ink-soft">
          Fake &ldquo;now&rdquo; set to <span className="font-mono">2026-04-17 19:00 UTC</span>.
          Renders HomeHero (all 5 states), DayList (with late + carried intents), StreakCard, and
          ItemFocus (scheduled, running late, stuck, with carry-over). Delete before ship.
        </p>
      </header>

      <PreviewFrame
        label="Full /me layout · up_next state"
        description="Mix of done, late (amber), on-deck (now), and carried-over (terracotta)."
      >
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-10 min-w-0">
            <HomeHero hero={{ state: 'up_next', item: baseItem, minutesUntil: 120 }} />
            <hr className="border-rule" />
            <DayList
              label="Today"
              hint="4 items · 2 h 20 min"
              items={todayItems}
              activeItemId={baseItem.id}
              now={NOW}
            />
            <DayList label={tomorrow.label} items={tomorrow.items} now={NOW} />
            <DayList label={sunday.label} items={sunday.items} now={NOW} />
          </div>
          <aside className="space-y-6">
            <StreakCard current={12} last7={[true, true, true, false, true, true, true]} />
          </aside>
        </div>
      </PreviewFrame>

      <PreviewFrame
        label="Full /me layout · running_late state"
        description="Hero is amber-bordered + vinho eyebrow; the late item still shows in Today as amber-bordered row."
      >
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-10 min-w-0">
            <HomeHero
              hero={{ state: 'running_late', item: lateEarlier, minutesLate: 180 }}
            />
            <hr className="border-rule" />
            <DayList label="Today" items={todayItems} now={NOW} />
          </div>
          <aside className="space-y-6">
            <StreakCard current={2} last7={[false, false, true, true, false, true, false]} />
          </aside>
        </div>
      </PreviewFrame>

      <PreviewFrame label="Hero · now">
        <HomeHero hero={{ state: 'now', item: { ...baseItem, scheduledAt: '2026-04-17T19:00:00Z' } }} />
      </PreviewFrame>

      <PreviewFrame label="Hero · all_done">
        <HomeHero hero={{ state: 'all_done', nextAt: tomorrow.items[0].scheduledAt }} />
      </PreviewFrame>

      <PreviewFrame label="Hero · free_day">
        <HomeHero hero={{ state: 'free_day', nextAt: tomorrow.items[0].scheduledAt }} />
      </PreviewFrame>

      <PreviewFrame label="Hero · null (no plan)">
        <HomeHero hero={null} />
      </PreviewFrame>

      <PreviewFrame
        label="Item focus · scheduled future · with carry-over"
        description="Terracotta left border on the carried-over section."
      >
        <ItemFocusReadonly item={sampleItem} outcomeMode="pick" />
      </PreviewFrame>

      <PreviewFrame
        label="Item focus · running late"
        description="Amber border-left + vinho eyebrow on the header."
      >
        <ItemFocusReadonly
          item={{ ...sampleItem, scheduledAt: '2026-04-17T15:00:00Z', carriedFrom: null }}
          outcomeMode="pick"
        />
      </PreviewFrame>

      <PreviewFrame
        label="Item focus · outcome=STUCK"
        description="Vinho banner at the bottom + mark locked in display mode."
      >
        <ItemFocusReadonly item={stuckItem} outcomeMode="done" />
      </PreviewFrame>
    </div>
  );
}
