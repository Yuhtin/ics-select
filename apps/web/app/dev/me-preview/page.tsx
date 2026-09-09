'use client';

import Link from 'next/link';
import { CalendarDays, Compass, Users } from 'lucide-react';
import { clsx } from 'clsx';
import type { HomeItem, TopicCoverage } from '../../../lib/queries/me-home';
import { BrandLockup } from '../../../components/shell/brand-lockup';
import { ThemeToggle } from '../../../components/ui/theme-toggle';
import { HeroScene } from '../../../components/member/hero-scene';
import { DayList } from '../../../components/member/day-list';
import { StreakCard } from '../../../components/ui/streak-card';
import { StudyTimeCard } from '../../../components/member/study-time-card';
import { TopRankingCard } from '../../../components/member/top-ranking-card';
import { TopicCoverageHeatmap } from '../../../components/member/topic-coverage-heatmap';

// Static data makes the real product components reproducible for visual review
// and the landing capture. No API, authentication, or live clock is required.
const NOW = new Date('2026-04-17T19:00:00Z');

const current: HomeItem = {
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
  scheduledAt: '2026-04-17T19:00:00Z',
  scheduledMinutes: 45,
  carriedFromItemId: null,
};

const today: HomeItem[] = [
  {
    ...current,
    id: 'i-recursion',
    order: 1,
    title: 'Recursion intro',
    format: 'VIDEO',
    estimatedMinutes: 30,
    scheduledMinutes: 30,
    url: 'https://youtube.com/watch?v=x',
    topic: { slug: 'recursion', label: 'Recursion' },
    outcome: 'DONE_EASY',
    scheduledAt: '2026-04-17T13:00:00Z',
  },
  current,
  {
    ...current,
    id: 'i-dp-intro',
    order: 3,
    title: 'Dynamic programming: revisit the foundations',
    topic: { slug: 'dp', label: 'Dynamic Programming' },
    carriedFromItemId: 'previous-attempt',
    scheduledAt: '2026-04-17T22:30:00Z',
  },
];

const tomorrow: HomeItem[] = [
  {
    ...current,
    id: 'i-hash',
    order: 4,
    title: 'Hash table patterns',
    topic: { slug: 'hashing', label: 'Hashing' },
    scheduledAt: '2026-04-18T12:00:00Z',
  },
  {
    ...current,
    id: 'i-jump',
    order: 5,
    title: 'Jump Game II',
    topic: { slug: 'greedy', label: 'Greedy' },
    scheduledAt: '2026-04-18T19:00:00Z',
  },
];

const topics: TopicCoverage[] = [
  { topicId: 'complexity', slug: 'complexity', label: 'Complexity', order: 0, itemsPlanned: 4, itemsDone: 4 },
  { topicId: 'recursion', slug: 'recursion', label: 'Recursion', order: 1, itemsPlanned: 4, itemsDone: 4 },
  { topicId: 'arrays', slug: 'arrays', label: 'Arrays', order: 2, itemsPlanned: 6, itemsDone: 4 },
  { topicId: 'hashing', slug: 'hashing', label: 'Hashing', order: 3, itemsPlanned: 4, itemsDone: 1 },
  { topicId: 'binary-search', slug: 'binary-search', label: 'Binary Search', order: 4, itemsPlanned: 3, itemsDone: 1 },
  { topicId: 'trees', slug: 'trees', label: 'Trees', order: 5, itemsPlanned: 0, itemsDone: 0 },
];

const NAV = [
  { href: '/me', label: 'Today', icon: Compass },
  { href: '/me/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/me/cohort', label: 'Cohort', icon: Users },
];

export default function MePreviewPage() {
  return (
    <div data-testid="academy-member-preview" className="min-h-[100dvh] bg-bg text-fg">
      <header className="border-b border-border-token bg-surface">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-2">
          <Link href="/me" className="inline-flex min-h-11 items-center rounded-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <BrandLockup size="sm" />
          </Link>
          <nav aria-label="Main navigation" className="order-3 flex w-full gap-1 md:order-none md:w-auto">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={href === '/me' ? 'page' : undefined}
                className={clsx(
                  'inline-flex min-h-11 items-center gap-2 rounded-input px-3 font-sans text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  href === '/me' ? 'bg-primary-soft text-primary dark:text-primary-fg' : 'text-fg-mute hover:bg-bg-subtle',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/me/settings" aria-label="Settings" className="inline-grid h-11 w-11 place-items-center rounded-full border border-border-token bg-bg-subtle text-xs font-semibold text-fg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              ED
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-8 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-6">
            <HeroScene hero={{ state: 'now', item: current }} />
            <DayList label="Today" hint="1/3 done · 2 h total" items={today} activeItemId={current.id} now={NOW} />
            <DayList label="Sat, Apr 18" hint="2 items · 1 h 30 min" items={tomorrow} now={NOW} />
          </div>
          <aside className="flex min-w-0 flex-col gap-5">
            <TopRankingCard ranking={[
              { userId: 'maria', name: 'Maria Oliveira', pictureUrl: null, score: 92, isMe: false },
              { userId: 'eduardo', name: 'Eduardo Santos', pictureUrl: null, score: 88, isMe: true },
              { userId: 'luiza', name: 'Luiza Costa', pictureUrl: null, score: 85, isMe: false },
            ]} />
            <StreakCard current={12} last7={[true, true, true, false, true, true, true]} />
            <StudyTimeCard studyTime={{ actualMinutes: 255, estimatedMinutes: 300, itemsWithTime: 6, itemsTotal: 8 }} />
            <section className="rounded-card border border-border-token bg-surface p-6">
              <h2 className="font-sans text-xs font-medium text-fg-mute">Topic coverage</h2>
              <div className="mt-4"><TopicCoverageHeatmap topics={topics} tileSize={18} /></div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
