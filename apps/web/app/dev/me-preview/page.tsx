'use client';

import Link from 'next/link';
import { UserRound } from 'lucide-react';
import { clsx } from 'clsx';
import type { HomeItem, TopicCoverage } from '../../../lib/queries/me-home';
import { BrandLockup } from '../../../components/shell/brand-lockup';
import { HeroScene } from '../../../components/member/hero-scene';
import { DayList } from '../../../components/member/day-list';
import { StreakCard } from '../../../components/ui/streak-card';
import { StudyTimeCard } from '../../../components/member/study-time-card';
import { TopRankingCard } from '../../../components/member/top-ranking-card';
import { MEMBER_NAV_ITEMS } from '../../../components/member-shell/member-nav';
import { StudioContextRail } from '../../../components/member/studio-context-rail';
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

const previewRanking = [
  { userId: 'maria', name: 'Maria Oliveira', pictureUrl: null, score: 92, isMe: false },
  { userId: 'eduardo', name: 'Eduardo Santos', pictureUrl: null, score: 88, isMe: true },
  { userId: 'luiza', name: 'Luiza Costa', pictureUrl: null, score: 85, isMe: false },
];

export default function MePreviewPage() {
  return (
    <div data-testid="academy-member-preview" className="min-h-[100dvh] bg-bg text-fg md:flex">
      {/* The deterministic preview shares the route model, but never mounts auth,
          Retro availability, logout, or theme persistence hooks. */}
      <aside data-testid="member-rail" className="sticky top-0 hidden h-[100dvh] w-[94px] shrink-0 bg-[hsl(var(--member-rail-bg))] md:flex md:flex-col">
        <nav aria-label="Main navigation" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-3">
          <Link href="/me" aria-label="Academy Fellow home" className="mb-3 grid min-h-11 place-items-center">
            <BrandLockup size="sm" showWordmark={false} tone="inverse" />
          </Link>
          {MEMBER_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={href === '/me' ? 'page' : undefined} className={clsx(
              'flex min-h-12 flex-col items-center justify-center gap-1 rounded-input px-1 font-sans text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              href === '/me' ? 'bg-primary text-primary-fg' : 'text-[hsl(var(--member-rail-fg))] hover:bg-[hsl(var(--member-rail-hover))] hover:text-primary-fg',
            )}>
              <Icon aria-hidden className="h-4 w-4" strokeWidth={href === '/me' ? 2 : 1.5} /><span>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <main className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
          <div className="mx-auto w-full max-w-[1360px] space-y-8 px-5 py-7 sm:px-6 md:py-9 min-[1200px]:px-8 min-[1440px]:px-10">
            <header>
              <p className="font-mono text-[11px] uppercase tracking-label text-fg-mute">Friday, April 17</p>
              <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.045em] sm:text-[40px]">Good afternoon, Eduardo.</h1>
            </header>
            <div className="grid gap-9 lg:grid-cols-[minmax(0,1.7fr)_minmax(240px,0.62fr)]">
              <div className="min-w-0 space-y-7">
                <HeroScene hero={{ state: 'now', item: current }} />
                <DayList label="Today" hint="1/3 done · 2 h total" items={today} activeItemId={current.id} now={NOW} />
                <DayList label="Sat, Apr 18" hint="2 items · 1 h 30 min" items={tomorrow} now={NOW} />
              </div>
              <StudioContextRail>
                <TopRankingCard ranking={previewRanking} presentation="context" />
                <StreakCard current={12} last7={[true, true, true, false, true, true, true]} presentation="context" />
                <StudyTimeCard studyTime={{ actualMinutes: 255, estimatedMinutes: 300, itemsWithTime: 6, itemsTotal: 8 }} presentation="context" />
                <section className="py-5">
                  <h2 className="text-xs font-medium text-fg-mute">Topic coverage</h2>
                  <div className="mt-4"><TopicCoverageHeatmap topics={topics} tileSize={18} presentation="context" /></div>
                </section>
              </StudioContextRail>
            </div>
          </div>
        </main>
      </div>
      <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-border-token bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="mx-auto flex max-w-xl">
          {[...MEMBER_NAV_ITEMS.filter((item) => item.mobile), { href: '/me/settings', label: 'Profile', icon: UserRound, mobile: true }].map(({ href, label, icon: Icon }) => (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={href === '/me' ? 'page' : undefined} className={clsx(
                'flex h-16 flex-col items-center justify-center gap-1 border-t-2 font-sans text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                href === '/me' ? 'border-primary bg-primary-soft text-primary dark:text-fg' : 'border-transparent text-fg-mute hover:bg-surface-hover hover:text-fg',
              )}>
                {href === '/me/settings' ? <span aria-hidden className="inline-grid h-5 w-5 place-items-center rounded-full border border-border-token bg-bg-subtle text-[9px] font-semibold text-fg-soft">ES</span> : <Icon aria-hidden className="h-5 w-5" strokeWidth={href === '/me' ? 2 : 1.5} />}
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
