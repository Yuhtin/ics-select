# Ranking Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the member cohort ranking with a top-3 spotlight scored by ciclo-aware minutes + consistency bonus (no % exibida), and add a new admin engagement ranking table below the cohort heatmap.

**Architecture:** Two independent surfaces. Member ranking computes a hidden score from `WeeklyPlanItem` data (cycle + 2× current week), surfaces only top 3 entries (`score > 0`) as visual cards. Admin ranking reuses the existing `computeEngagementScore` (0–100, 6 criteria) ordered descending with full breakdown per row. A small input-builder helper (`engagement-inputs.ts`) is added so the new admin ranking and existing per-member cockpit eventually share the same input math.

**Tech Stack:** NestJS 10 + Prisma 5 (`apps/api`), Next.js 15 App Router + HeroUI + TanStack Query (`apps/web`), Jest unit tests + Playwright snapshots.

**Spec:** `docs/superpowers/specs/2026-05-04-ranking-redesign-design.md`

---

## File map

**Created:**
- `apps/api/src/me/cohort/member-ranking.ts` — pure helper computing the score for a cohort
- `apps/api/src/me/cohort/member-ranking.spec.ts` — unit tests for the pure helper
- `apps/api/src/admin/cockpit/engagement-inputs.ts` — pure helper that builds `EngagementInput` for a set of users
- `apps/api/src/admin/cockpit/engagement-inputs.spec.ts` — unit tests
- `apps/web/components/member/cohort-spotlight.tsx` — new "On fire" top-3 component
- `apps/web/components/admin/engagement-ranking-table.tsx` — new admin ranking table

**Modified:**
- `apps/api/src/me/cohort/cohort.service.ts` — replace `byUser`/percent ranking block with `computeMemberRanking` call; update query to span the whole cycle and include `completedAt` + `libraryItem.estimatedMinutes`; cap response to top 3
- `apps/api/src/me/cohort/cohort.service.spec.ts` — replace percent-based ranking expectations with score-based ones; add cases for cap, empty, sub-3
- `apps/api/src/admin/cycle/cycle-overview.service.ts` — add `computeEngagementRanking` step + `ranking` field on response; use `engagement-inputs` helper
- `apps/api/src/admin/cycle/cycle-overview.service.spec.ts` — new cases asserting ranking, breakdown, alert flag
- `apps/web/lib/queries/me-cohort.ts` — drop `percent`/`done`/`total` from `MemberRank`, add `score`
- `apps/web/lib/queries/admin-cycle.ts` — add `EngagementRankingRow` and `ranking` to `CycleOverviewResponse`
- `apps/web/app/(member)/me/cohort/page.tsx` — reorder sections (spotlight above Activity), swap to `<CohortSpotlight>`
- `apps/web/components/admin/cycle/cycle-overview-view.tsx` — render `<EngagementRankingTable>` below the heatmap

**Deleted:**
- `apps/web/components/member/cohort-ranking.tsx` — replaced by `<CohortSpotlight>`

---

## Task 1: Member ranking — pure helper

**Files:**
- Create: `apps/api/src/me/cohort/member-ranking.ts`
- Create: `apps/api/src/me/cohort/member-ranking.spec.ts`

The helper takes per-user item arrays and the current week window, returns the top-3 entries (`score > 0` only). Tests live next to the source file.

- [ ] **Step 1: Write the failing test file**

Create `apps/api/src/me/cohort/member-ranking.spec.ts` with:

```ts
import { computeMemberRanking, type MemberRankingUser } from './member-ranking';

const WEEK_START = new Date('2026-04-13T00:00:00.000Z'); // Monday UTC
const WEEK_END = new Date('2026-04-19T23:59:59.999Z');   // Sunday UTC end
const NOW = new Date('2026-04-17T12:00:00.000Z');         // mid-week Friday

function user(
  userId: string,
  name: string,
  items: Array<{ outcome: string; completedAt: string | null; estimatedMinutes: number }>,
): MemberRankingUser {
  return {
    userId,
    name,
    pictureUrl: null,
    items: items.map((i) => ({
      outcome: i.outcome as any,
      completedAt: i.completedAt ? new Date(i.completedAt) : null,
      libraryItem: { estimatedMinutes: i.estimatedMinutes },
    })),
  };
}

describe('computeMemberRanking', () => {
  it('returns empty array when no member has score > 0', () => {
    const result = computeMemberRanking(
      [user('u1', 'Alice', [])],
      WEEK_START,
      WEEK_END,
      'me',
    );
    expect(result).toEqual([]);
  });

  it('weighs DONE_HARD 1.2× DONE_EASY for the same minutes', () => {
    const easy = user('u-easy', 'Easy', [
      { outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 },
    ]);
    const hard = user('u-hard', 'Hard', [
      { outcome: 'DONE_HARD', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 },
    ]);
    const result = computeMemberRanking([easy, hard], WEEK_START, WEEK_END, 'me');
    expect(result[0]!.userId).toBe('u-hard');
    expect(result[1]!.userId).toBe('u-easy');
  });

  it('weighs SKIPPED at 0.3', () => {
    // 100 min SKIPPED = 30 min_weighted; 30 min DONE_EASY = 30 min_weighted.
    // Both with 1 day of activity → consistency 20.
    // pontos_ciclo (≡ pontos_semana for this case) = 30 + 20 = 50.
    // score = 50 + 2 × 50 = 150 for both → tied, alphabetical order kicks in.
    const skipped = user('u-skipped', 'Bravo', [
      { outcome: 'SKIPPED', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 100 },
    ]);
    const done = user('u-done', 'Alpha', [
      { outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 30 },
    ]);
    const result = computeMemberRanking([skipped, done], WEEK_START, WEEK_END, 'me');
    expect(result[0]!.userId).toBe('u-done');    // Alpha < Bravo
    expect(result[1]!.userId).toBe('u-skipped');
  });

  it('STUCK and PENDING contribute 0 points', () => {
    const stuckOnly = user('u-stuck', 'Stuck', [
      { outcome: 'STUCK', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 },
      { outcome: 'PENDING', completedAt: null, estimatedMinutes: 60 },
    ]);
    const result = computeMemberRanking([stuckOnly], WEEK_START, WEEK_END, 'me');
    expect(result).toEqual([]);
  });

  it('rewards consistency: 5 days × 1h beats 1 day × 5h', () => {
    const consistent = user('u-cons', 'Consistent', [
      { outcome: 'DONE_EASY', completedAt: '2026-04-13T10:00:00Z', estimatedMinutes: 60 },
      { outcome: 'DONE_EASY', completedAt: '2026-04-14T10:00:00Z', estimatedMinutes: 60 },
      { outcome: 'DONE_EASY', completedAt: '2026-04-15T10:00:00Z', estimatedMinutes: 60 },
      { outcome: 'DONE_EASY', completedAt: '2026-04-16T10:00:00Z', estimatedMinutes: 60 },
      { outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 },
    ]);
    const marathon = user('u-mara', 'Marathon', [
      { outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 300 },
    ]);
    const result = computeMemberRanking([consistent, marathon], WEEK_START, WEEK_END, 'me');
    expect(result[0]!.userId).toBe('u-cons');
    expect(result[1]!.userId).toBe('u-mara');
  });

  it('current-week activity weighs ~3× past-week activity', () => {
    // Both members did 60min DONE_EASY total. One last week, one this week.
    // Past-only: pontos_ciclo = 60 + 20 = 80; pontos_semana = 0; score = 80.
    // This-week-only: pontos_ciclo = 80; pontos_semana = 80; score = 80 + 160 = 240.
    const past = user('u-past', 'Past', [
      { outcome: 'DONE_EASY', completedAt: '2026-04-08T10:00:00Z', estimatedMinutes: 60 },
    ]);
    const now = user('u-now', 'Now', [
      { outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 },
    ]);
    const result = computeMemberRanking([past, now], WEEK_START, WEEK_END, 'me');
    expect(result[0]!.userId).toBe('u-now');
    expect(result[1]!.userId).toBe('u-past');
    expect(result[0]!.score).toBe(240);
    expect(result[1]!.score).toBe(80);
  });

  it('caps at top 3 even when more members qualify', () => {
    const users = ['a', 'b', 'c', 'd', 'e'].map((id, idx) =>
      user(`u-${id}`, `User ${id.toUpperCase()}`, [
        { outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 30 + idx * 10 },
      ]),
    );
    const result = computeMemberRanking(users, WEEK_START, WEEK_END, 'me');
    expect(result).toHaveLength(3);
    // Highest minutes win → e (70) > d (60) > c (50)
    expect(result.map((r) => r.userId)).toEqual(['u-e', 'u-d', 'u-c']);
  });

  it('returns 2 entries when only 2 members have score > 0', () => {
    const users = [
      user('u-a', 'A', [{ outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 30 }]),
      user('u-b', 'B', [{ outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 }]),
      user('u-c', 'C', []),
    ];
    const result = computeMemberRanking(users, WEEK_START, WEEK_END, 'me');
    expect(result).toHaveLength(2);
    expect(result[0]!.userId).toBe('u-b');
  });

  it('sets isMe flag for the current user', () => {
    const users = [
      user('u-other', 'Other', [{ outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 }]),
      user('u-me', 'Me', [{ outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 30 }]),
    ];
    const result = computeMemberRanking(users, WEEK_START, WEEK_END, 'u-me');
    expect(result.find((r) => r.userId === 'u-me')!.isMe).toBe(true);
    expect(result.find((r) => r.userId === 'u-other')!.isMe).toBe(false);
  });

  it('alphabetical tiebreak when score and consistency identical', () => {
    const users = [
      user('u-z', 'Zara', [{ outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 }]),
      user('u-a', 'Ana', [{ outcome: 'DONE_EASY', completedAt: '2026-04-17T10:00:00Z', estimatedMinutes: 60 }]),
    ];
    const result = computeMemberRanking(users, WEEK_START, WEEK_END, 'me');
    expect(result[0]!.userId).toBe('u-a');
    expect(result[1]!.userId).toBe('u-z');
  });

  it('ignores items without completedAt', () => {
    const users = [
      user('u-1', 'A', [
        { outcome: 'DONE_EASY', completedAt: null, estimatedMinutes: 60 },
      ]),
    ];
    const result = computeMemberRanking(users, WEEK_START, WEEK_END, 'me');
    expect(result).toEqual([]);
  });

  it('counts UTC days, not wall-clock — same UTC day = 1 day bonus', () => {
    const users = [
      user('u-1', 'A', [
        { outcome: 'DONE_EASY', completedAt: '2026-04-17T01:00:00Z', estimatedMinutes: 30 },
        { outcome: 'DONE_EASY', completedAt: '2026-04-17T23:00:00Z', estimatedMinutes: 30 },
      ]),
    ];
    const result = computeMemberRanking(users, WEEK_START, WEEK_END, 'me');
    // 60 min × 1.0 + 20 × 1 day = 80 (cycle); same for week. score = 80 + 160 = 240.
    expect(result[0]!.score).toBe(240);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm --filter @ics-select/api test -- --testPathPattern member-ranking
```

Expected: FAIL — `Cannot find module './member-ranking'`.

- [ ] **Step 3: Write the helper**

Create `apps/api/src/me/cohort/member-ranking.ts`:

```ts
import type { ItemOutcome } from '@ics-select/prisma';

export type MemberRankingUser = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  items: Array<{
    outcome: ItemOutcome;
    completedAt: Date | null;
    libraryItem: { estimatedMinutes: number };
  }>;
};

export type MemberRankingEntry = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  score: number;
  isMe: boolean;
};

const OUTCOME_WEIGHT: Record<ItemOutcome, number> = {
  DONE_EASY: 1.0,
  DONE_HARD: 1.2,
  DOUBTS: 1.0,
  SKIPPED: 0.3,
  STUCK: 0,
  PENDING: 0,
};

const CONSISTENCY_BONUS_PER_DAY = 20;
const CURRENT_WEEK_MULTIPLIER = 2;
const TOP_N = 3;

function utcDayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

type Pontos = {
  minutesWeighted: number;
  distinctDays: Set<string>;
};

function emptyPontos(): Pontos {
  return { minutesWeighted: 0, distinctDays: new Set() };
}

function pontosTotal(p: Pontos): number {
  return p.minutesWeighted + CONSISTENCY_BONUS_PER_DAY * p.distinctDays.size;
}

export function computeMemberRanking(
  users: MemberRankingUser[],
  weekStart: Date,
  weekEnd: Date,
  currentUserId: string,
): MemberRankingEntry[] {
  const scored = users.map((u) => {
    const cycle = emptyPontos();
    const week = emptyPontos();

    for (const item of u.items) {
      if (!item.completedAt) continue;
      const weight = OUTCOME_WEIGHT[item.outcome];
      if (weight === 0) continue;
      const minutes = item.libraryItem.estimatedMinutes ?? 0;
      const minutesWeighted = minutes * weight;
      const dayKey = utcDayKey(item.completedAt);

      cycle.minutesWeighted += minutesWeighted;
      cycle.distinctDays.add(dayKey);

      if (item.completedAt >= weekStart && item.completedAt <= weekEnd) {
        week.minutesWeighted += minutesWeighted;
        week.distinctDays.add(dayKey);
      }
    }

    const pontosCiclo = pontosTotal(cycle);
    const pontosSemana = pontosTotal(week);
    const score = pontosCiclo + CURRENT_WEEK_MULTIPLIER * pontosSemana;

    return {
      user: u,
      score,
      consistencyDaysCycle: cycle.distinctDays.size,
      pontosSemana,
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.consistencyDaysCycle !== a.consistencyDaysCycle) {
        return b.consistencyDaysCycle - a.consistencyDaysCycle;
      }
      if (b.pontosSemana !== a.pontosSemana) return b.pontosSemana - a.pontosSemana;
      return a.user.name.localeCompare(b.user.name, 'pt-BR', { sensitivity: 'base' });
    })
    .slice(0, TOP_N)
    .map(({ user }) => ({
      userId: user.userId,
      name: user.name,
      pictureUrl: user.pictureUrl,
      score: scored.find((s) => s.user.userId === user.userId)!.score,
      isMe: user.userId === currentUserId,
    }));
}
```

- [ ] **Step 4: Run tests until they pass**

```
pnpm --filter @ics-select/api test -- --testPathPattern member-ranking
```

Expected: all 11 tests PASS.

- [ ] **Step 5: Commit**

```
git add apps/api/src/me/cohort/member-ranking.ts apps/api/src/me/cohort/member-ranking.spec.ts
git commit -m "feat(member-ranking): add pure helper for cohort spotlight scoring"
```

---

## Task 2: Wire member ranking into CohortService

**Files:**
- Modify: `apps/api/src/me/cohort/cohort.service.ts:156-190` (replace `byUser`/percent block)
- Modify: `apps/api/src/me/cohort/cohort.service.spec.ts:63-97` (rewrite percent-based test)

The cycle-wide query needs `completedAt` and `libraryItem.estimatedMinutes`. The response shape `MemberRank` loses `percent`/`done`/`total`, gains `score`. Cap to top 3 happens inside `computeMemberRanking`, so the service just hands the array to the response.

- [ ] **Step 1: Update CohortService — replace types**

In `apps/api/src/me/cohort/cohort.service.ts`, replace the existing `MemberRank` type (lines 15–23):

```ts
type MemberRank = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  score: number;
  isMe: boolean;
};
```

- [ ] **Step 2: Update CohortService — replace the ranking block**

Replace the `if ((cycle as any).rankingVisibleToMembers) { ... }` block (lines 156–190) with:

```ts
let ranking: MemberRank[] | undefined;
if ((cycle as any).rankingVisibleToMembers) {
  const plans = await this.prisma.weeklyPlan.findMany({
    where: {
      userId: { in: userIds },
      status: 'PUBLISHED',
      weekStart: { gte: cycle.startsAt, lte: now },
    },
    include: {
      items: {
        select: {
          outcome: true,
          completedAt: true,
          libraryItem: { select: { estimatedMinutes: true } },
        },
      },
    },
  });

  const itemsByUser = new Map<string, MemberRankingUser['items']>();
  for (const plan of plans) {
    const bucket = itemsByUser.get(plan.userId) ?? [];
    bucket.push(...((plan as any).items as MemberRankingUser['items']));
    itemsByUser.set(plan.userId, bucket);
  }

  const rankingInput: MemberRankingUser[] = (cycle as any).memberships.map(
    (m: any) => ({
      userId: m.userId,
      name: m.user.name,
      pictureUrl: m.user.pictureUrl ?? null,
      items: itemsByUser.get(m.userId) ?? [],
    }),
  );

  ranking = computeMemberRanking(rankingInput, weekStart, weekEnd, userId);
}
```

Add the import at the top of the file:

```ts
import { computeMemberRanking, type MemberRankingUser } from './member-ranking';
```

Remove the now-unused `POSITIVE_OUTCOMES` import if nothing else uses it (check the file — `feed` building uses `isPositiveOutcome`, not `POSITIVE_OUTCOMES`, so the latter can be dropped).

- [ ] **Step 3: Update existing spec — rewrite the percent-based ranking test**

Replace the `'includes sorted ranking with isMe flag when visible'` test in `apps/api/src/me/cohort/cohort.service.spec.ts` (lines 63–97) with:

```ts
it('includes sorted top-3 ranking with isMe flag when visible', async () => {
  prisma.cycleMembership.findFirst.mockResolvedValue({
    cycleId: 'c-1',
    cycle: {
      id: 'c-1',
      name: '2026.1',
      rankingVisibleToMembers: true,
      startsAt: new Date('2026-04-01T00:00:00Z'),
      endsAt: new Date('2026-06-30T00:00:00Z'),
    },
  } as any);
  prisma.cycle.findUnique.mockResolvedValue({
    id: 'c-1',
    name: '2026.1',
    rankingVisibleToMembers: true,
    startsAt: new Date('2026-04-01T00:00:00Z'),
    endsAt: new Date('2026-06-30T00:00:00Z'),
    memberships: [
      { userId: 'user-1', user: { id: 'user-1', name: 'Me', email: 'me@inteli.edu.br', pictureUrl: null } },
      { userId: 'user-2', user: { id: 'user-2', name: 'Alice', email: 'alice@inteli.edu.br', pictureUrl: null } },
    ],
  } as any);
  // user-2 (Alice) — 60min DONE_EASY this week
  // user-1 (Me)    — 30min DONE_EASY this week
  prisma.weeklyPlan.findMany.mockResolvedValue([
    {
      id: 'plan-me',
      userId: 'user-1',
      items: [
        {
          outcome: 'DONE_EASY',
          completedAt: new Date('2026-04-15T10:00:00Z'),
          libraryItem: { estimatedMinutes: 30 },
        },
      ],
    },
    {
      id: 'plan-alice',
      userId: 'user-2',
      items: [
        {
          outcome: 'DONE_EASY',
          completedAt: new Date('2026-04-15T10:00:00Z'),
          libraryItem: { estimatedMinutes: 60 },
        },
      ],
    },
  ] as any);
  prisma.weeklyPlanItem.findMany.mockResolvedValue([]);
  prisma.weeklyRetro.findMany.mockResolvedValue([]);

  const result = await service.getCohort('user-1', new Date('2026-04-17T19:00:00Z'));
  expect(result.ranking).toHaveLength(2);
  expect(result.ranking![0]!.userId).toBe('user-2');   // Alice (60min) → higher score
  expect(result.ranking![1]!.userId).toBe('user-1');   // Me (30min)
  expect(result.ranking!.find((r) => r.isMe)?.userId).toBe('user-1');
});
```

Add a new test below for the empty case:

```ts
it('returns empty ranking when ranking is visible but no member has score > 0', async () => {
  prisma.cycleMembership.findFirst.mockResolvedValue({
    cycleId: 'c-1',
    cycle: {
      id: 'c-1',
      name: '2026.1',
      rankingVisibleToMembers: true,
      startsAt: new Date('2026-04-01T00:00:00Z'),
      endsAt: new Date('2026-06-30T00:00:00Z'),
    },
  } as any);
  prisma.cycle.findUnique.mockResolvedValue({
    id: 'c-1',
    name: '2026.1',
    rankingVisibleToMembers: true,
    startsAt: new Date('2026-04-01T00:00:00Z'),
    endsAt: new Date('2026-06-30T00:00:00Z'),
    memberships: [
      { userId: 'user-1', user: { id: 'user-1', name: 'Me', email: 'me@inteli.edu.br', pictureUrl: null } },
    ],
  } as any);
  prisma.weeklyPlan.findMany.mockResolvedValue([]);
  prisma.weeklyPlanItem.findMany.mockResolvedValue([]);
  prisma.weeklyRetro.findMany.mockResolvedValue([]);

  const result = await service.getCohort('user-1', new Date('2026-04-17T19:00:00Z'));
  expect(result.ranking).toEqual([]);
});
```

- [ ] **Step 4: Run cohort.service tests**

```
pnpm --filter @ics-select/api test -- --testPathPattern cohort.service
```

Expected: all CohortService tests PASS.

- [ ] **Step 5: Run typecheck**

```
pnpm --filter @ics-select/api typecheck
```

Expected: no errors. (If errors come from `apps/web` consumers of the changed type, ignore for now — they're fixed in Task 3.)

- [ ] **Step 6: Commit**

```
git add apps/api/src/me/cohort/cohort.service.ts apps/api/src/me/cohort/cohort.service.spec.ts
git commit -m "feat(cohort): swap percent ranking for top-3 score-based ranking"
```

---

## Task 3: Member spotlight UI

**Files:**
- Create: `apps/web/components/member/cohort-spotlight.tsx`
- Modify: `apps/web/lib/queries/me-cohort.ts`
- Modify: `apps/web/app/(member)/me/cohort/page.tsx`
- Delete: `apps/web/components/member/cohort-ranking.tsx`

Frontend type updates ride on the API change. The new component renders top-3 cards with relative-intensity dots; the page reorders so the spotlight is above Activity.

- [ ] **Step 1: Update the type in `me-cohort.ts`**

In `apps/web/lib/queries/me-cohort.ts`, replace the `MemberRank` type (lines 14–22):

```ts
export type MemberRank = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  score: number;
  isMe: boolean;
};
```

- [ ] **Step 2: Create the spotlight component**

Create `apps/web/components/member/cohort-spotlight.tsx`:

```tsx
'use client';
import { clsx } from 'clsx';
import type { MemberRank } from '../../lib/queries/me-cohort';
import { SectionLabel } from '../ui/section-label';

interface CohortSpotlightProps {
  ranking: MemberRank[];
  className?: string;
}

function dotsForIntensity(intensity: number): { filled: number; empty: number } {
  if (intensity >= 0.66) return { filled: 3, empty: 0 };
  if (intensity >= 0.33) return { filled: 2, empty: 1 };
  return { filled: 1, empty: 2 };
}

function Dots({ filled, empty }: { filled: number; empty: number }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: filled }).map((_, i) => (
        <span key={`f-${i}`} className="text-focus">●</span>
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e-${i}`} className="text-rule">○</span>
      ))}
    </div>
  );
}

export function CohortSpotlight({ ranking, className }: CohortSpotlightProps) {
  if (ranking.length === 0) return null;

  const top1Score = ranking[0]!.score;

  return (
    <div className={clsx('space-y-4', className)}>
      <SectionLabel>On fire</SectionLabel>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {ranking.map((entry, idx) => {
          const intensity = idx === 0 ? 1 : top1Score > 0 ? entry.score / top1Score : 0;
          const dots = dotsForIntensity(intensity);
          return (
            <div
              key={entry.userId}
              className={clsx(
                'flex flex-col items-center gap-3 rounded-card border p-4',
                entry.isMe ? 'border-ink' : 'border-rule',
              )}
            >
              <div className="h-12 w-12 overflow-hidden rounded-full bg-paper-warm">
                {entry.pictureUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.pictureUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <p className="font-serif text-base font-medium text-ink">
                {entry.name}
                {entry.isMe && <span className="ml-1 text-ink-mute">(you)</span>}
              </p>
              <Dots filled={dots.filled} empty={dots.empty} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update the cohort page to reorder and use the new component**

Replace the body of `apps/web/app/(member)/me/cohort/page.tsx`:

```tsx
'use client';
import { clsx } from 'clsx';
import { useMeCohort } from '../../../../lib/queries/me-cohort';
import { CohortFeed } from '../../../../components/member/cohort-feed';
import { CohortSpotlight } from '../../../../components/member/cohort-spotlight';
import { CohortRoster } from '../../../../components/member/cohort-roster';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { SectionLabel } from '../../../../components/ui/section-label';

export default function MeCohortPage() {
  const { data, isLoading } = useMeCohort();
  if (isLoading || !data) {
    return (
      <p className="font-mono text-xs uppercase tracking-eyebrow text-fg-mute">
        Loading…
      </p>
    );
  }
  const hasRanking = Array.isArray(data.ranking) && data.ranking.length > 0;
  const hasMembers = data.members.length > 0;

  return (
    <div className="max-w-6xl space-y-10">
      <div>
        <Eyebrow>{`Cohort · ${data.cycleName || 'active cycle'}`}</Eyebrow>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">
          {data.memberCount === 0
            ? 'No cohort yet.'
            : `${data.memberCount} classmates this cycle`}
        </h1>
      </div>

      <div
        className={clsx(
          'gap-10',
          hasMembers ? 'flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_340px]' : '',
        )}
      >
        <div className="min-w-0 space-y-10 md:order-1">
          {hasRanking && (
            <section>
              <CohortSpotlight ranking={data.ranking!} />
            </section>
          )}

          <section className="space-y-4">
            <SectionLabel>Activity · last 7d</SectionLabel>
            <CohortFeed feed={data.feed} />
          </section>
        </div>

        {hasMembers && (
          <aside className="md:order-2 md:sticky md:top-6 md:max-h-[calc(100vh-3rem)] md:overflow-y-auto">
            <CohortRoster members={data.members} />
          </aside>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Delete the old ranking component**

```
rm apps/web/components/member/cohort-ranking.tsx
```

- [ ] **Step 5: Verify nothing else imports the deleted component**

```
grep -rn "cohort-ranking" apps/web/ --include='*.ts' --include='*.tsx'
```

Expected: no results. If anything appears, follow the error and remove the dangling import.

- [ ] **Step 6: Build the web app to typecheck**

```
pnpm --filter @ics-select/web build
```

Expected: build succeeds. (TypeScript catches the type drop on `MemberRank.percent`/`done`/`total` if anything else read them.)

- [ ] **Step 7: Commit**

```
git add apps/web/components/member/cohort-spotlight.tsx \
        apps/web/lib/queries/me-cohort.ts \
        apps/web/app/(member)/me/cohort/page.tsx
git rm apps/web/components/member/cohort-ranking.tsx
git commit -m "feat(member/cohort): replace ranking list with top-3 On fire spotlight"
```

---

## Task 4: Engagement-inputs helper for cohorts

**Files:**
- Create: `apps/api/src/admin/cockpit/engagement-inputs.ts`
- Create: `apps/api/src/admin/cockpit/engagement-inputs.spec.ts`

This helper builds an `EngagementInput` per member of a cohort using a single batched query, mirroring the math `CockpitService.computeCohortMedians` already does (lines 677–728 in `cockpit.service.ts`). It's a new, additive helper — `cockpit.service.ts` is **not** modified yet (refactoring it to share this helper is out of scope for now; the spec calls it out as a future cleanup).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/admin/cockpit/engagement-inputs.spec.ts`:

```ts
import { computeEngagementInputsForCohort } from './engagement-inputs';

const CYCLE_START = new Date('2026-04-06T00:00:00Z');
const NOW = new Date('2026-04-17T12:00:00Z');

function makePrisma(rows: Array<{
  userId: string;
  sessions: number;
  daysActive: number;
  daysStudying: number;
  itemsDone: number;
  itemsPlanned: number;
  retrosSubmitted: number;
  daysSinceLastSession: number | null;
}>) {
  return {
    $queryRawUnsafe: jest.fn(async () =>
      rows.map((r) => ({
        userId: r.userId,
        sessions: r.sessions,
        daysActive: r.daysActive,
        daysStudying: r.daysStudying,
        itemsDone: r.itemsDone,
        itemsPlanned: r.itemsPlanned,
        retrosSubmitted: r.retrosSubmitted,
        daysSinceLastSession: r.daysSinceLastSession,
      })),
    ),
  };
}

describe('computeEngagementInputsForCohort', () => {
  it('returns empty map for empty cohort', async () => {
    const prisma = makePrisma([]);
    const result = await computeEngagementInputsForCohort(
      prisma as any,
      [],
      'cycle-1',
      CYCLE_START,
      NOW,
    );
    expect(result.size).toBe(0);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('returns one input per user with computed daysElapsed/weeksElapsed', async () => {
    const prisma = makePrisma([
      {
        userId: 'u-1',
        sessions: 5,
        daysActive: 8,
        daysStudying: 6,
        itemsDone: 10,
        itemsPlanned: 12,
        retrosSubmitted: 1,
        daysSinceLastSession: 2,
      },
    ]);
    const result = await computeEngagementInputsForCohort(
      prisma as any,
      ['u-1'],
      'cycle-1',
      CYCLE_START,
      NOW,
    );
    expect(result.size).toBe(1);
    const input = result.get('u-1')!;
    expect(input.itemsDone).toBe(10);
    expect(input.itemsPlanned).toBe(12);
    expect(input.daysActive).toBe(8);
    expect(input.retrosSubmitted).toBe(1);
    expect(input.daysSinceLastSession).toBe(2);
    expect(input.daysElapsed).toBe(11); // 2026-04-06 → 2026-04-17 = 11 days
    expect(input.weeksElapsed).toBe(2); // ceil(11/7)
    expect(input.cohortSize).toBe(0); // single member, no peers
  });

  it('passes cohortSize equal to other-than-self count for ranking semantics', async () => {
    const prisma = makePrisma([
      { userId: 'u-1', sessions: 1, daysActive: 1, daysStudying: 1, itemsDone: 1, itemsPlanned: 1, retrosSubmitted: 0, daysSinceLastSession: 1 },
      { userId: 'u-2', sessions: 2, daysActive: 2, daysStudying: 2, itemsDone: 2, itemsPlanned: 2, retrosSubmitted: 0, daysSinceLastSession: 1 },
      { userId: 'u-3', sessions: 3, daysActive: 3, daysStudying: 3, itemsDone: 3, itemsPlanned: 3, retrosSubmitted: 0, daysSinceLastSession: 1 },
    ]);
    const result = await computeEngagementInputsForCohort(
      prisma as any,
      ['u-1', 'u-2', 'u-3'],
      'cycle-1',
      CYCLE_START,
      NOW,
    );
    // For each user, cohortSize = number of OTHER cohort members (matching the
    // contract used by CockpitService.getCockpit).
    expect(result.get('u-1')!.cohortSize).toBe(2);
    expect(result.get('u-2')!.cohortSize).toBe(2);
    expect(result.get('u-3')!.cohortSize).toBe(2);
  });

  it('orders cohortRankFromBottom by itemsDone ascending', async () => {
    const prisma = makePrisma([
      { userId: 'u-low', sessions: 1, daysActive: 1, daysStudying: 1, itemsDone: 1, itemsPlanned: 5, retrosSubmitted: 0, daysSinceLastSession: 1 },
      { userId: 'u-mid', sessions: 1, daysActive: 1, daysStudying: 1, itemsDone: 5, itemsPlanned: 5, retrosSubmitted: 0, daysSinceLastSession: 1 },
      { userId: 'u-top', sessions: 1, daysActive: 1, daysStudying: 1, itemsDone: 10, itemsPlanned: 10, retrosSubmitted: 0, daysSinceLastSession: 1 },
    ]);
    const result = await computeEngagementInputsForCohort(
      prisma as any,
      ['u-low', 'u-mid', 'u-top'],
      'cycle-1',
      CYCLE_START,
      NOW,
    );
    expect(result.get('u-low')!.cohortRankFromBottom).toBe(0);
    expect(result.get('u-mid')!.cohortRankFromBottom).toBe(1);
    expect(result.get('u-top')!.cohortRankFromBottom).toBe(2);
  });

  it('computes cohortMedianItemsPlanned across cohort', async () => {
    const prisma = makePrisma([
      { userId: 'u-a', sessions: 1, daysActive: 1, daysStudying: 1, itemsDone: 1, itemsPlanned: 4, retrosSubmitted: 0, daysSinceLastSession: 1 },
      { userId: 'u-b', sessions: 1, daysActive: 1, daysStudying: 1, itemsDone: 1, itemsPlanned: 8, retrosSubmitted: 0, daysSinceLastSession: 1 },
      { userId: 'u-c', sessions: 1, daysActive: 1, daysStudying: 1, itemsDone: 1, itemsPlanned: 12, retrosSubmitted: 0, daysSinceLastSession: 1 },
    ]);
    const result = await computeEngagementInputsForCohort(
      prisma as any,
      ['u-a', 'u-b', 'u-c'],
      'cycle-1',
      CYCLE_START,
      NOW,
    );
    expect(result.get('u-a')!.cohortMedianItemsPlanned).toBe(8);
  });

  it('omits ttfvMedianHours per-user (treats it as 0 for cohort ranking)', async () => {
    const prisma = makePrisma([
      { userId: 'u-1', sessions: 1, daysActive: 1, daysStudying: 1, itemsDone: 1, itemsPlanned: 1, retrosSubmitted: 0, daysSinceLastSession: 1 },
    ]);
    const result = await computeEngagementInputsForCohort(
      prisma as any,
      ['u-1'],
      'cycle-1',
      CYCLE_START,
      NOW,
    );
    expect(result.get('u-1')!.ttfvMedianHours).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm --filter @ics-select/api test -- --testPathPattern engagement-inputs
```

Expected: FAIL — `Cannot find module './engagement-inputs'`.

- [ ] **Step 3: Write the helper**

Create `apps/api/src/admin/cockpit/engagement-inputs.ts`:

```ts
import type { PrismaService } from '../../common/prisma/prisma.service.js';
import type { EngagementInput } from './engagement-score.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Builds an EngagementInput per cohort member using a single batched query.
 * Used by the cycle-overview ranking. Per-user ttfvMedianHours is treated as
 * 0 here (computing it per-user across a cohort is expensive and the cycle
 * ranking can tolerate this simplification — the cockpit individual page
 * still computes the real value via its own path).
 */
export async function computeEngagementInputsForCohort(
  prisma: PrismaService,
  userIds: string[],
  cycleId: string,
  cycleStart: Date,
  now: Date,
): Promise<Map<string, EngagementInput>> {
  if (userIds.length === 0) return new Map();

  const rows = await prisma.$queryRawUnsafe<Array<{
    userId: string;
    sessions: number;
    daysActive: number;
    daysStudying: number;
    itemsDone: number;
    itemsPlanned: number;
    retrosSubmitted: number;
    daysSinceLastSession: number | null;
  }>>(
    `SELECT
       u."userId",
       COALESCE(ev_sess.cnt, 0)   AS sessions,
       COALESCE(ev_days.cnt, 0)   AS "daysActive",
       COALESCE(ev_study.cnt, 0)  AS "daysStudying",
       COALESCE(wp_done.cnt, 0)   AS "itemsDone",
       COALESCE(wp_plan.cnt, 0)   AS "itemsPlanned",
       COALESCE(retro.cnt, 0)     AS "retrosSubmitted",
       last_ev."daysSinceLastSession" AS "daysSinceLastSession"
     FROM unnest($1::text[]) AS u("userId")
     LEFT JOIN (
       SELECT "userId", COUNT(*)::int AS cnt FROM "UserEvent"
       WHERE "userId" = ANY($1::text[]) AND "type" = 'SESSION_START'
         AND "occurredAt" BETWEEN $2 AND $3
       GROUP BY "userId"
     ) ev_sess ON ev_sess."userId" = u."userId"
     LEFT JOIN (
       SELECT "userId", COUNT(DISTINCT date_trunc('day', "occurredAt"))::int AS cnt FROM "UserEvent"
       WHERE "userId" = ANY($1::text[]) AND "occurredAt" BETWEEN $2 AND $3
       GROUP BY "userId"
     ) ev_days ON ev_days."userId" = u."userId"
     LEFT JOIN (
       SELECT "userId", COUNT(DISTINCT date_trunc('day', "occurredAt"))::int AS cnt FROM "UserEvent"
       WHERE "userId" = ANY($1::text[]) AND "type" = 'OUTCOME_MARKED'
         AND "occurredAt" BETWEEN $2 AND $3
       GROUP BY "userId"
     ) ev_study ON ev_study."userId" = u."userId"
     LEFT JOIN (
       SELECT wp."userId", COUNT(*)::int AS cnt
       FROM "WeeklyPlanItem" wpi JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
       WHERE wp."cycleId" = $4 AND wp."userId" = ANY($1::text[]) AND wpi."outcome" <> 'PENDING'
       GROUP BY wp."userId"
     ) wp_done ON wp_done."userId" = u."userId"
     LEFT JOIN (
       SELECT wp."userId", COUNT(*)::int AS cnt
       FROM "WeeklyPlanItem" wpi JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
       WHERE wp."cycleId" = $4 AND wp."userId" = ANY($1::text[])
       GROUP BY wp."userId"
     ) wp_plan ON wp_plan."userId" = u."userId"
     LEFT JOIN (
       SELECT "userId", COUNT(*)::int AS cnt FROM "WeeklyRetro"
       WHERE "cycleId" = $4 AND "userId" = ANY($1::text[])
       GROUP BY "userId"
     ) retro ON retro."userId" = u."userId"
     LEFT JOIN (
       SELECT "userId",
              FLOOR(EXTRACT(EPOCH FROM ($3 - MAX("occurredAt"))) / 86400)::int AS "daysSinceLastSession"
       FROM "UserEvent"
       WHERE "userId" = ANY($1::text[])
       GROUP BY "userId"
     ) last_ev ON last_ev."userId" = u."userId"`,
    userIds,
    cycleStart,
    now,
    cycleId,
  );

  const daysElapsed = Math.max(1, Math.floor((now.getTime() - cycleStart.getTime()) / DAY_MS));
  const weeksElapsed = Math.max(1, Math.ceil(daysElapsed / 7));

  const sortedByDone = [...rows]
    .map((r) => ({ userId: r.userId, itemsDone: Number(r.itemsDone) }))
    .sort((a, b) => a.itemsDone - b.itemsDone);
  const rankIndex = new Map<string, number>();
  sortedByDone.forEach((r, idx) => rankIndex.set(r.userId, idx));

  const plannedSorted = rows.map((r) => Number(r.itemsPlanned)).sort((a, b) => a - b);
  let cohortMedianItemsPlanned = 0;
  if (plannedSorted.length > 0) {
    const mid = Math.floor(plannedSorted.length / 2);
    cohortMedianItemsPlanned = Math.round(
      plannedSorted.length % 2 === 0
        ? (plannedSorted[mid - 1]! + plannedSorted[mid]!) / 2
        : plannedSorted[mid]!,
    );
  }

  const cohortSize = Math.max(0, userIds.length - 1);
  const out = new Map<string, EngagementInput>();
  for (const row of rows) {
    out.set(row.userId, {
      cohortRankFromBottom: rankIndex.get(row.userId) ?? 0,
      cohortSize,
      daysActive: Number(row.daysActive),
      daysElapsed,
      itemsDone: Number(row.itemsDone),
      itemsPlanned: Number(row.itemsPlanned),
      retrosSubmitted: Number(row.retrosSubmitted),
      weeksElapsed,
      ttfvMedianHours: 0,
      daysSinceLastSession:
        row.daysSinceLastSession === null ? null : Number(row.daysSinceLastSession),
      cohortMedianItemsPlanned,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run tests until they pass**

```
pnpm --filter @ics-select/api test -- --testPathPattern engagement-inputs
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```
git add apps/api/src/admin/cockpit/engagement-inputs.ts apps/api/src/admin/cockpit/engagement-inputs.spec.ts
git commit -m "feat(cockpit): add engagement-inputs helper for cohort ranking"
```

---

## Task 5: Admin engagement ranking in CycleOverviewService

**Files:**
- Modify: `apps/api/src/admin/cycle/cycle-overview.service.ts`
- Modify: `apps/api/src/admin/cycle/cycle-overview.service.spec.ts`

Add a new ranking field on the response, populated by calling `computeEngagementInputsForCohort` + `computeEngagementScore` per member.

- [ ] **Step 1: Update the response type**

In `apps/api/src/admin/cycle/cycle-overview.service.ts`, add to the type imports at the top:

```ts
import { computeEngagementScore, type ScoreBreakdownEntry } from '../cockpit/engagement-score.js';
import { computeEngagementInputsForCohort } from '../cockpit/engagement-inputs.js';
```

Extend `CycleOverviewResponse` (around line 26–72) with a `ranking` field:

```ts
ranking: Array<{
  userId: string;
  name: string;
  pictureUrl: string | null;
  score: number;
  breakdown: ScoreBreakdownEntry[];
  hasAlert: boolean;
}>;
```

- [ ] **Step 2: Compute the ranking inside `getOverview`**

Inside `getOverview` in `cycle-overview.service.ts`, after the `members` array is built and `membersWithStuck` is populated (around the existing `feed.sort(...)` line), insert:

```ts
const engagementInputs = await computeEngagementInputsForCohort(
  this.prisma,
  userIds,
  cycle.id,
  mondayUTC(cycle.startsAt),
  now,
);
const ranking = memberships
  .map((m) => {
    const input = engagementInputs.get(m.userId);
    if (!input) {
      return {
        userId: m.userId,
        name: m.user.name,
        pictureUrl: m.user.pictureUrl,
        score: 0,
        breakdown: [],
        hasAlert: membersWithStuck.has(m.userId),
        cohortPts: 0,
      };
    }
    const result = computeEngagementScore(input);
    const cohortBreakdown = result.breakdown.find((b) => b.label === 'Cohort rank');
    return {
      userId: m.userId,
      name: m.user.name,
      pictureUrl: m.user.pictureUrl,
      score: result.score,
      breakdown: result.breakdown,
      hasAlert: membersWithStuck.has(m.userId),
      cohortPts: cohortBreakdown?.value ?? 0,
    };
  })
  .sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.cohortPts !== a.cohortPts) return b.cohortPts - a.cohortPts;
    return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
  })
  .map(({ cohortPts, ...rest }) => rest);
```

You'll also need a `mondayUTC` helper in this file (it doesn't have one yet). Check the top of the file — if absent, add at the top after the imports:

```ts
function mondayUTC(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = out.getUTCDay();
  out.setUTCDate(out.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return out;
}
```

(If `cycle.startsAt` is already on a Monday boundary by convention, `mondayUTC` is a no-op — keeping it makes the contract explicit and robust to non-Monday inputs.)

- [ ] **Step 3: Add `ranking` to the returned object**

In the return statement at the bottom of `getOverview`, add:

```ts
return {
  cycle: { /* unchanged */ },
  members,
  heatmap: { /* unchanged */ },
  feed,
  ranking,
};
```

- [ ] **Step 4: Add a test for the new ranking**

In `apps/api/src/admin/cycle/cycle-overview.service.spec.ts`, locate the `makePrisma` helper. Extend it with a `$queryRawUnsafe` mock so `computeEngagementInputsForCohort` doesn't crash:

```ts
function makePrisma(overrides: Partial<any> = {}): PrismaMock {
  const base: PrismaMock = {
    cycle: { findUnique: jest.fn(async () => null) },
    weeklyPlan: { findMany: jest.fn(async () => []) },
    weeklyPlanItem: { findMany: jest.fn(async () => []) },
    weeklyRetro: { findMany: jest.fn(async () => []) },
    memberAvailability: { findMany: jest.fn(async () => []) },
    $queryRawUnsafe: jest.fn(async () => []) as any,
  };
  for (const key of Object.keys(overrides) as (keyof PrismaMock)[]) {
    base[key] = { ...base[key], ...(overrides[key] as any) };
  }
  return base;
}
```

(Update the `PrismaMock` type to include `$queryRawUnsafe: jest.Mock`.)

Add a new test at the bottom of the existing `describe('CycleOverviewService', ...)` block:

```ts
it('returns engagement ranking ordered by score with breakdown and alert flag', async () => {
  const prisma = makePrisma({
    cycle: {
      findUnique: jest.fn(async () => ({
        ...baseCycle,
        memberships: [memberA, memberB],
      })),
    },
    weeklyPlanItem: {
      findMany: jest.fn(async () => [
        { weeklyPlan: { userId: 'user-a' } }, // STUCK proxy → alert
      ]),
    },
    $queryRawUnsafe: jest.fn(async () => [
      {
        userId: 'user-a',
        sessions: 10,
        daysActive: 10,
        daysStudying: 10,
        itemsDone: 12,
        itemsPlanned: 12,
        retrosSubmitted: 2,
        daysSinceLastSession: 1,
      },
      {
        userId: 'user-b',
        sessions: 1,
        daysActive: 2,
        daysStudying: 1,
        itemsDone: 1,
        itemsPlanned: 12,
        retrosSubmitted: 0,
        daysSinceLastSession: 10,
      },
    ]),
  });
  const service = makeService(prisma);
  const result = await service.getOverview('cycle-1', NOW);

  expect(result.ranking).toHaveLength(2);
  expect(result.ranking[0]!.userId).toBe('user-a');
  expect(result.ranking[1]!.userId).toBe('user-b');
  expect(result.ranking[0]!.score).toBeGreaterThan(result.ranking[1]!.score);
  expect(result.ranking[0]!.breakdown).toHaveLength(6);
  expect(result.ranking[0]!.hasAlert).toBe(true);
  expect(result.ranking[1]!.hasAlert).toBe(false);
});

it('returns empty ranking when cohort has no memberships', async () => {
  const prisma = makePrisma({
    cycle: {
      findUnique: jest.fn(async () => ({ ...baseCycle, memberships: [] })),
    },
  });
  const service = makeService(prisma);
  const result = await service.getOverview('cycle-1', NOW);
  expect(result.ranking).toEqual([]);
});
```

- [ ] **Step 5: Run cycle-overview tests**

```
pnpm --filter @ics-select/api test -- --testPathPattern cycle-overview.service
```

Expected: all tests PASS, including the two new ones.

- [ ] **Step 6: Run full API test suite to catch regressions**

```
pnpm --filter @ics-select/api test
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```
git add apps/api/src/admin/cycle/cycle-overview.service.ts \
        apps/api/src/admin/cycle/cycle-overview.service.spec.ts
git commit -m "feat(admin/cycle): add engagement ranking to overview response"
```

---

## Task 6: Admin engagement ranking UI

**Files:**
- Modify: `apps/web/lib/queries/admin-cycle.ts`
- Create: `apps/web/components/admin/engagement-ranking-table.tsx`
- Modify: `apps/web/components/admin/cycle/cycle-overview-view.tsx`

- [ ] **Step 1: Update the query type**

In `apps/web/lib/queries/admin-cycle.ts`, add the new types and extend `CycleOverviewResponse`:

```ts
export type EngagementBreakdownEntry = {
  label: string;
  value: number;
  weight: number;
  status: 'ok' | 'warn' | 'bad';
};

export type EngagementRankingRow = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  score: number;
  breakdown: EngagementBreakdownEntry[];
  hasAlert: boolean;
};

export type CycleOverviewResponse = {
  cycle: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    status: 'ACTIVE' | 'ARCHIVED';
    rankingVisibleToMembers: boolean;
    weekNumber: number;
    weeksTotal: number;
  };
  members: CycleOverviewMember[];
  heatmap: {
    weeks: CycleOverviewHeatmapWeek[];
    rows: CycleOverviewHeatmapRow[];
  };
  feed: CycleOverviewFeedEvent[];
  ranking: EngagementRankingRow[];
};
```

- [ ] **Step 2: Create the table component**

Create `apps/web/components/admin/engagement-ranking-table.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { clsx } from 'clsx';
import type { EngagementRankingRow } from '../../lib/queries/admin-cycle';

interface EngagementRankingTableProps {
  ranking: EngagementRankingRow[];
}

const COLUMN_LABELS: Array<{ key: string; label: string }> = [
  { key: 'Cohort rank',        label: 'COHORT' },
  { key: 'Days active',        label: 'ACTIVE' },
  { key: 'Plan completion',    label: 'COMPL' },
  { key: 'Retros submitted',   label: 'RETRO' },
  { key: 'Time to first view', label: 'TTFV' },
  { key: 'Recency',            label: 'RECEN' },
];

function scoreColor(score: number): string {
  if (score >= 66) return 'text-done-easy';
  if (score >= 33) return 'text-done-hard';
  return 'text-stuck';
}

export function EngagementRankingTable({ ranking }: EngagementRankingTableProps) {
  if (ranking.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full font-serif-tool tabular-nums text-sm">
        <thead>
          <tr className="border-b-2 border-ink text-left">
            <th className="py-2 pr-2 font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute">##</th>
            <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute">Member</th>
            <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute">Score</th>
            {COLUMN_LABELS.map((c) => (
              <th key={c.key} className="py-2 pr-4 font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute">
                {c.label}
              </th>
            ))}
            <th className="py-2 font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute" aria-label="alert" />
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {ranking.map((row, idx) => (
            <tr key={row.userId} className="group hover:bg-paper-warm">
              <td className="py-2 pr-2 font-mono text-xs text-ink-mute">
                {String(idx + 1).padStart(2, '0')}
              </td>
              <td className="py-2 pr-4">
                <Link
                  href={`/admin/member/${row.userId}`}
                  className="flex items-center gap-2 font-serif font-medium text-ink hover:underline"
                >
                  <span className="block h-6 w-6 overflow-hidden rounded-full bg-paper-warm">
                    {row.pictureUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.pictureUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  {row.name}
                </Link>
              </td>
              <td className={clsx('py-2 pr-4 font-mono', scoreColor(row.score))}>
                {row.score}/100
              </td>
              {COLUMN_LABELS.map((c) => {
                const entry = row.breakdown.find((b) => b.label === c.key);
                return (
                  <td key={c.key} className="py-2 pr-4 font-mono text-ink-soft">
                    {entry ? entry.value : 0}
                  </td>
                );
              })}
              <td className="py-2 font-mono text-stuck">
                {row.hasAlert ? '⚠' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Wire the component into the cycle overview**

In `apps/web/components/admin/cycle/cycle-overview-view.tsx`, add the import:

```tsx
import { EngagementRankingTable } from '../engagement-ranking-table';
```

In the same `<div className="min-w-0 space-y-10">` that contains Triage and the heatmap (around line 81–144), add a new block right after the heatmap `<div className="space-y-3">...</div>`:

```tsx
<div className="space-y-3">
  <SectionLabel>Engagement ranking</SectionLabel>
  <EngagementRankingTable ranking={data.ranking} />
</div>
```

- [ ] **Step 4: Build the web app**

```
pnpm --filter @ics-select/web build
```

Expected: build succeeds.

- [ ] **Step 5: Run the dev server and check visually**

```
pnpm --filter @ics-select/web dev
```

Open `http://localhost:3000/admin/cycle/<id>` (replace `<id>` with an active cycle id from your local DB). Verify:
- Table appears below the cohort heatmap.
- Score color reflects threshold (green ≥66, amber 33–65, red <33).
- Hovering a row highlights it; clicking the name navigates to `/admin/member/[id]`.
- Alert column shows `⚠` for any member with a STUCK item in window.

Open `http://localhost:3000/me/cohort` (logged in as a member). Verify:
- "On fire" spotlight appears at the top, above Activity.
- Top 1 has 3 filled dots; others scale.
- Self card has thicker `border-ink` and `(you)` label when applicable.

Stop the dev server when done.

- [ ] **Step 6: Commit**

```
git add apps/web/lib/queries/admin-cycle.ts \
        apps/web/components/admin/engagement-ranking-table.tsx \
        apps/web/components/admin/cycle/cycle-overview-view.tsx
git commit -m "feat(admin/cycle): render engagement ranking table below heatmap"
```

---

## Task 7: Playwright snapshot updates

**Files:**
- Modify: `apps/web/tests/cohort.spec.ts` (or whichever existing spec covers `/me/cohort`)
- Modify: `apps/web/tests/admin-cockpit.spec.ts` or the cycle-overview spec, depending on what exists

The Playwright suite uses snapshot baselines. After the UI changes, snapshots that include the cohort or cycle overview pages need to be regenerated.

- [ ] **Step 1: Locate affected specs**

```
grep -rn "/me/cohort\|/admin/cycle" apps/web/tests/
```

Expected: a small set of files. Typical names: `cohort.spec.ts`, `admin-cycle.spec.ts`, `admin-cockpit.spec.ts`.

- [ ] **Step 2: Run the affected specs and inspect failures**

```
pnpm --filter @ics-select/web test -- cohort
pnpm --filter @ics-select/web test -- admin-cycle
```

Expected: snapshot mismatches on `/me/cohort` (spotlight replaces ranking) and `/admin/cycle/[id]` (new table). DOM-assertion failures for selectors that referenced `.cohort-ranking` or `data-percent` are real bugs in the test that need updating.

- [ ] **Step 3: Update DOM-assertion selectors where needed**

Read each failing spec; if a `getByTestId('cohort-ranking')` or similar lookup fails, update to match the new component. The old `cohort-ranking` component is gone; replace with `getByText('On fire')` for the spotlight section, or `getByRole('table')` for the admin table.

If a spec asserts `data-percent` or numeric percentages on the cohort page, those assertions are now stale — remove them. The spotlight intentionally hides numbers.

- [ ] **Step 4: Regenerate snapshots**

```
pnpm --filter @ics-select/web test:update -- cohort admin-cycle
```

- [ ] **Step 5: Re-run the suite to confirm green**

```
pnpm --filter @ics-select/web test
```

Expected: all PASS. If a non-cohort/non-admin-cycle test fails, that's a real regression — fix it before continuing.

- [ ] **Step 6: Commit**

```
git add apps/web/tests/
git commit -m "test(playwright): update cohort + admin-cycle snapshots for ranking redesign"
```

---

## Task 8: Final verification

**Files:** none (verification only)

Sanity check the whole change before declaring done.

- [ ] **Step 1: Run the full test suite from the repo root**

```
pnpm test
```

Expected: green across `shared`, `api`, `web`.

- [ ] **Step 2: Run typecheck and lint**

```
pnpm typecheck
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Smoke test in dev mode**

```
pnpm dev
```

In browser:
- `/me/cohort` (member account): spotlight above Activity, top 3 cards with relative dots, self-highlight when applicable, no numeric % anywhere.
- `/admin/cycle/<id>`: new ranking table below heatmap, score-colored, alert column populated, row links work.
- Toggle ranking visibility off via the admin RankingToggle: spotlight section disappears entirely from `/me/cohort`. Toggle back on: it returns.

Stop the dev server.

- [ ] **Step 4: Diff review**

```
git log --oneline origin/main..HEAD
git diff --stat origin/main..HEAD
```

Skim the changed files. Confirm:
- No leftover `MemberRank.percent`/`done`/`total` references.
- No imports of the deleted `cohort-ranking.tsx`.
- `cohort.service.ts` no longer imports `POSITIVE_OUTCOMES` (unless still used elsewhere in the file for the feed building — check before removing).

- [ ] **Step 5: Push branch**

If the work happened in a worktree on a feature branch:

```
git push -u origin HEAD
```

Then open the PR through the project's normal flow (or with `gh pr create` if you're doing it from the CLI).

---

## Notes on what was deliberately left out

- **`CockpitService` refactor to consume `engagement-inputs.ts`.** The spec mentions both call sites should share the helper. This plan adds the helper as net-new (no behavior change to cockpit). Refactoring `CockpitService.getCockpit` to consume the helper is a follow-up — the regression risk on the live cockpit is non-trivial and the deduplication win is small enough to defer.
- **`scoreByWeek` per-week ranking sparkline.** Stays out of the admin ranking table per spec ("not exibido pra não poluir a tabela").
- **Mobile-responsive admin table.** Admin is desktop-first; the table renders horizontally on small screens (overflow-x).
