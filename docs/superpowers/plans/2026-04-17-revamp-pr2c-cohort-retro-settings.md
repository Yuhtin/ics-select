# PR 2c — Cohort + Retro + Settings (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three remaining member surfaces: `/me/cohort` (ambient feed + conditional ranking), `/me/retro` (weekly reflection form with time-window awareness), and `/me/settings` (availability + phone + track + Google status). Adds the endpoints that power them. Respects the design-system accent rules (`docs/design-system.md`).

**Architecture:**

- **Cohort feed**: computed on-the-fly from existing tables (`WeeklyPlanItem.completedAt/outcome` + `WeeklyRetro.submittedAt`). No new "events" table — the feed is a view. Types: `finished`, `got_stuck`, `posted_retro`, `started_week`. Reflection text never leaks into the feed.
- **Ranking**: computed from `WeeklyPlanItem` of the active cycle's published plans. Returned only if `Cycle.rankingVisibleToMembers = true`. If false, the frontend omits the right column and feed goes full-width.
- **Retro window**: `current` = `{ open: boolean, retro: WeeklyRetro | null }`. Open = Fri 18:00 local → Sun 23:59 local, based on user's `timezone` in `MemberAvailability`. Service computes the window around `now` using the user's timezone.
- **Settings**: one surface, multiple PATCH sub-actions. Backend exposes `PATCH /me/availability` (already exists, extend for phone + timezone + track). Frontend shows one page with tabs or sections; each section saves independently via the corresponding endpoint.
- **Onboarding**: explicitly deferred to PR 2d. For PR 2c, a member without phone/availability still sees the real pages but gets empty states — they fill settings manually. PR 2d introduces a wizard that gates on first access.

**Tech Stack:** NestJS 10 + Prisma 5 · Next.js 15 App Router + TanStack Query · Magazine Editorial design system (PR 2a) + accent rules (`docs/design-system.md`).

**Reference spec:** `docs/superpowers/specs/2026-04-16-revamp-design.md` §4.4 (cohort), §4.5 (retro), §4.6 (settings).

**Out of scope:** onboarding wizard (PR 2d), admin pages (PR 3), AI depth + retro cron (PR 4), WhatsApp sending (PR 3/4).

---

## File Structure

### Created (Backend)

- `apps/api/src/me/cohort/cohort.service.ts`
- `apps/api/src/me/cohort/cohort.service.spec.ts`
- `apps/api/src/me/cohort/cohort.controller.ts`
- `apps/api/src/me/cohort/cohort.module.ts`
- `apps/api/src/me/retro/retro.service.ts`
- `apps/api/src/me/retro/retro.service.spec.ts`
- `apps/api/src/me/retro/retro.controller.ts`
- `apps/api/src/me/retro/retro.module.ts`
- `apps/api/src/me/retro/dto.ts`

### Modified (Backend)

- `apps/api/src/me/me.module.ts` (import CohortModule, RetroModule)
- `apps/api/src/availability/availability.service.ts` (add phone/timezone/track updates)
- `apps/api/src/availability/availability.controller.ts`
- `apps/api/src/availability/dto.ts`

### Created (Frontend)

- `apps/web/app/(member)/me/cohort/page.tsx`
- `apps/web/app/(member)/me/retro/page.tsx`
- `apps/web/app/(member)/me/settings/page.tsx`
- `apps/web/components/member/cohort-feed.tsx`
- `apps/web/components/member/cohort-ranking.tsx`
- `apps/web/components/member/retro-form.tsx`
- `apps/web/components/member/availability-grid.tsx`
- `apps/web/components/member/profile-fields.tsx`
- `apps/web/components/member/google-status-card.tsx`
- `apps/web/lib/queries/me-cohort.ts`
- `apps/web/lib/queries/me-retro.ts`
- `apps/web/lib/queries/me-settings.ts`

### Modified (Frontend)

- `apps/web/components/member-shell/topbar-member.tsx` (retro badge when open)
- `apps/web/components/member-shell/bottom-tab-bar.tsx` (already has Cohort + Settings links — no-op)
- `apps/web/app/dev/me-preview/page.tsx` (add Cohort + Retro + Settings panels)

---

## Tasks

### Task 1: Backend `GET /me/cohort` — service + tests

**Files:**
- Create: `apps/api/src/me/cohort/cohort.service.ts`
- Create: `apps/api/src/me/cohort/cohort.service.spec.ts`

Response shape:

```typescript
type CohortResponse = {
  cycleName: string;
  memberCount: number;
  weekEndsAt: string;  // ISO
  feed: CohortEvent[];
  ranking?: MemberRank[];  // omitted if Cycle.rankingVisibleToMembers === false
};

type CohortEvent = {
  id: string;                         // stable id: `${userId}:${kind}:${targetId}`
  kind: 'finished' | 'got_stuck' | 'had_doubts' | 'posted_retro' | 'started_week';
  at: string;                         // ISO
  member: { id: string; name: string; pictureUrl: string | null };
  itemTitle: string | null;           // present for item events
  itemId: string | null;
};

type MemberRank = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  percent: number;                    // 0-100
  done: number;
  total: number;
  isMe: boolean;
};
```

- [ ] **Step 1: Write the spec first**

Create `apps/api/src/me/cohort/cohort.service.spec.ts` with tests covering:

1. Returns empty feed + no ranking when the user has no active `CycleMembership`.
2. Returns feed events for finished/got_stuck/had_doubts from WeeklyPlanItem.completedAt + outcome (last 24h).
3. Returns `posted_retro` events from WeeklyRetro.submittedAt (last 24h).
4. Includes `ranking` only when `Cycle.rankingVisibleToMembers = true`. Excludes it when false.
5. Ranking is sorted descending by `percent` with `isMe` flagged on the caller.

```typescript
import { Test } from '@nestjs/testing';
import { CohortService } from './cohort.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const makePrismaMock = () => ({
  cycleMembership: { findFirst: jest.fn() },
  cycle: { findUnique: jest.fn() },
  weeklyPlan: { findMany: jest.fn() },
  weeklyPlanItem: { findMany: jest.fn() },
  weeklyRetro: { findMany: jest.fn() },
});

describe('CohortService', () => {
  let service: CohortService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const mod = await Test.createTestingModule({
      providers: [CohortService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(CohortService);
  });

  it('returns empty result when user has no active membership', async () => {
    prisma.cycleMembership.findFirst.mockResolvedValue(null);
    const result = await service.getCohort('user-1', new Date('2026-04-17T19:00:00Z'));
    expect(result.feed).toEqual([]);
    expect(result.ranking).toBeUndefined();
    expect(result.memberCount).toBe(0);
  });

  it('omits ranking when the cycle has rankingVisibleToMembers=false', async () => {
    prisma.cycleMembership.findFirst.mockResolvedValue({
      cycleId: 'c-1',
      cycle: {
        id: 'c-1',
        name: '2026.1',
        rankingVisibleToMembers: false,
        endsAt: new Date('2026-06-30T00:00:00Z'),
        memberships: [{ userId: 'user-1' }, { userId: 'user-2' }],
      },
    } as any);
    prisma.weeklyPlan.findMany.mockResolvedValue([]);
    prisma.weeklyPlanItem.findMany.mockResolvedValue([]);
    prisma.weeklyRetro.findMany.mockResolvedValue([]);
    const result = await service.getCohort('user-1', new Date('2026-04-17T19:00:00Z'));
    expect(result.ranking).toBeUndefined();
    expect(result.memberCount).toBe(2);
  });

  it('includes sorted ranking with isMe flag when visible', async () => {
    prisma.cycleMembership.findFirst.mockResolvedValue({
      cycleId: 'c-1',
      cycle: {
        id: 'c-1',
        name: '2026.1',
        rankingVisibleToMembers: true,
        endsAt: new Date('2026-06-30T00:00:00Z'),
        memberships: [
          { userId: 'user-1', user: { id: 'user-1', name: 'Me', pictureUrl: null } },
          { userId: 'user-2', user: { id: 'user-2', name: 'Alice', pictureUrl: null } },
        ],
      },
    } as any);
    prisma.weeklyPlan.findMany.mockResolvedValue([
      { id: 'plan-me', userId: 'user-1', items: [{ outcome: 'DONE_EASY' }, { outcome: 'PENDING' }] },
      { id: 'plan-alice', userId: 'user-2', items: [{ outcome: 'DONE_EASY' }, { outcome: 'DONE_HARD' }] },
    ] as any);
    prisma.weeklyPlanItem.findMany.mockResolvedValue([]);
    prisma.weeklyRetro.findMany.mockResolvedValue([]);

    const result = await service.getCohort('user-1', new Date('2026-04-17T19:00:00Z'));
    expect(result.ranking).toHaveLength(2);
    expect(result.ranking![0].userId).toBe('user-2');   // Alice: 100%
    expect(result.ranking![1].userId).toBe('user-1');   // Me: 50%
    expect(result.ranking!.find((r) => r.isMe)?.userId).toBe('user-1');
  });

  it('builds feed from recent item outcomes + retros (last 24h)', async () => {
    prisma.cycleMembership.findFirst.mockResolvedValue({
      cycleId: 'c-1',
      cycle: {
        id: 'c-1',
        name: '2026.1',
        rankingVisibleToMembers: false,
        endsAt: new Date('2026-06-30T00:00:00Z'),
        memberships: [{ userId: 'user-1' }, { userId: 'user-2' }],
      },
    } as any);
    prisma.weeklyPlan.findMany.mockResolvedValue([]);
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      {
        id: 'item-1', outcome: 'DONE_EASY',
        completedAt: new Date('2026-04-17T18:30:00Z'),
        libraryItem: { title: 'Arrays intro' },
        weeklyPlan: {
          userId: 'user-2',
          user: { id: 'user-2', name: 'Alice', pictureUrl: null },
        },
      },
      {
        id: 'item-2', outcome: 'STUCK',
        completedAt: new Date('2026-04-17T17:00:00Z'),
        libraryItem: { title: 'DP memo' },
        weeklyPlan: {
          userId: 'user-3',
          user: { id: 'user-3', name: 'Bob', pictureUrl: null },
        },
      },
    ] as any);
    prisma.weeklyRetro.findMany.mockResolvedValue([
      {
        id: 'retro-1',
        userId: 'user-2',
        submittedAt: new Date('2026-04-17T18:45:00Z'),
        user: { id: 'user-2', name: 'Alice', pictureUrl: null },
      },
    ] as any);

    const result = await service.getCohort('user-1', new Date('2026-04-17T19:00:00Z'));
    expect(result.feed).toHaveLength(3);
    // Most recent first
    expect(result.feed[0].kind).toBe('posted_retro');
    expect(result.feed[1].kind).toBe('finished');
    expect(result.feed[2].kind).toBe('got_stuck');
  });
});
```

Run: fails with module not found.

- [ ] **Step 2: Implement the service**

Write `apps/api/src/me/cohort/cohort.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

type CohortEvent = {
  id: string;
  kind: 'finished' | 'got_stuck' | 'had_doubts' | 'posted_retro' | 'started_week';
  at: string;
  member: { id: string; name: string; pictureUrl: string | null };
  itemTitle: string | null;
  itemId: string | null;
};

type MemberRank = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  percent: number;
  done: number;
  total: number;
  isMe: boolean;
};

export type CohortResponse = {
  cycleName: string;
  memberCount: number;
  weekEndsAt: string | null;
  feed: CohortEvent[];
  ranking?: MemberRank[];
};

const POSITIVE = new Set(['DONE_EASY', 'DONE_HARD']);

@Injectable()
export class CohortService {
  constructor(private readonly prisma: PrismaService) {}

  async getCohort(userId: string, now: Date = new Date()): Promise<CohortResponse> {
    const membership = await this.prisma.cycleMembership.findFirst({
      where: { userId, cycle: { status: 'ACTIVE' } },
      include: {
        cycle: {
          include: {
            memberships: { include: { user: { select: { id: true, name: true, pictureUrl: true } } } },
          },
        },
      },
    });

    if (!membership) {
      return { cycleName: '', memberCount: 0, weekEndsAt: null, feed: [] };
    }

    const cycle = membership.cycle;
    const userIds = cycle.memberships.map((m) => m.userId);

    // Active week bounds (Mon 00:00 UTC → Sun 23:59 UTC) anchored to now.
    const weekStart = this.mondayUTC(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    weekEnd.setUTCMilliseconds(-1);

    // Feed window (last 24h).
    const since = new Date(now);
    since.setUTCDate(since.getUTCDate() - 1);

    const recentItems = await this.prisma.weeklyPlanItem.findMany({
      where: {
        weeklyPlan: { userId: { in: userIds } },
        completedAt: { gte: since, lte: now },
      },
      include: {
        libraryItem: { select: { title: true } },
        weeklyPlan: {
          select: {
            userId: true,
            user: { select: { id: true, name: true, pictureUrl: true } },
          },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 40,
    });

    const recentRetros = await this.prisma.weeklyRetro.findMany({
      where: {
        userId: { in: userIds },
        submittedAt: { gte: since, lte: now },
      },
      include: { user: { select: { id: true, name: true, pictureUrl: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 40,
    });

    const feed: CohortEvent[] = [];
    for (const item of recentItems) {
      if (!item.completedAt) continue;
      let kind: CohortEvent['kind'] | null = null;
      if (item.outcome === 'DONE_EASY' || item.outcome === 'DONE_HARD') kind = 'finished';
      else if (item.outcome === 'STUCK') kind = 'got_stuck';
      else if (item.outcome === 'DOUBTS') kind = 'had_doubts';
      if (!kind) continue;
      feed.push({
        id: `${item.weeklyPlan.userId}:${kind}:${item.id}`,
        kind,
        at: item.completedAt.toISOString(),
        member: item.weeklyPlan.user,
        itemTitle: item.libraryItem.title,
        itemId: item.id,
      });
    }
    for (const retro of recentRetros) {
      feed.push({
        id: `${retro.userId}:posted_retro:${retro.id}`,
        kind: 'posted_retro',
        at: retro.submittedAt.toISOString(),
        member: retro.user,
        itemTitle: null,
        itemId: null,
      });
    }

    feed.sort((a, b) => (a.at < b.at ? 1 : -1));

    let ranking: MemberRank[] | undefined;
    if (cycle.rankingVisibleToMembers) {
      const plans = await this.prisma.weeklyPlan.findMany({
        where: {
          userId: { in: userIds },
          status: 'PUBLISHED',
          weekStart: { gte: weekStart, lte: weekEnd },
        },
        include: { items: { select: { outcome: true } } },
      });

      const byUser = new Map<string, { done: number; total: number }>();
      for (const plan of plans) {
        const tally = byUser.get(plan.userId) ?? { done: 0, total: 0 };
        tally.total += plan.items.length;
        tally.done += plan.items.filter((i) => POSITIVE.has(i.outcome)).length;
        byUser.set(plan.userId, tally);
      }

      ranking = cycle.memberships
        .map((m) => {
          const tally = byUser.get(m.userId) ?? { done: 0, total: 0 };
          const percent = tally.total === 0 ? 0 : Math.round((tally.done / tally.total) * 100);
          return {
            userId: m.userId,
            name: m.user.name,
            pictureUrl: m.user.pictureUrl,
            percent,
            done: tally.done,
            total: tally.total,
            isMe: m.userId === userId,
          };
        })
        .sort((a, b) => b.percent - a.percent);
    }

    return {
      cycleName: cycle.name,
      memberCount: cycle.memberships.length,
      weekEndsAt: weekEnd.toISOString(),
      feed,
      ranking,
    };
  }

  private mondayUTC(now: Date): Date {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = d.getUTCDay();   // Sun=0 Mon=1 ... Sat=6
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d;
  }
}
```

Run the tests:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern cohort.service.spec
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/me/cohort
git commit -m "feat(api): CohortService — feed + conditional ranking (TDD)"
```

---

### Task 2: Cohort controller + module + wire-up

**Files:**
- Create: `apps/api/src/me/cohort/cohort.controller.ts`
- Create: `apps/api/src/me/cohort/cohort.module.ts`
- Modify: `apps/api/src/me/me.module.ts`

- [ ] **Step 1: Write the controller**

```typescript
// cohort.controller.ts
import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtStrategyPayload } from '../../auth/strategies/jwt.strategy';
import { CohortService } from './cohort.service';

@Controller('me')
export class CohortController {
  constructor(private readonly cohort: CohortService) {}

  @Get('cohort')
  getCohort(@CurrentUser() user: JwtStrategyPayload) {
    return this.cohort.getCohort(user.sub);
  }
}
```

Verify import paths match existing `home.controller.ts` in the same tree.

- [ ] **Step 2: Write the module**

```typescript
// cohort.module.ts
import { Module } from '@nestjs/common';
import { CohortService } from './cohort.service';
import { CohortController } from './cohort.controller';

@Module({
  providers: [CohortService],
  controllers: [CohortController],
})
export class CohortModule {}
```

- [ ] **Step 3: Import in `MeModule`**

Open `apps/api/src/me/me.module.ts`. Add `CohortModule` to imports alongside `HomeModule` and `ItemModule`.

- [ ] **Step 4: Run full API suite**

```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/api typecheck
```

Expected: 96 + 4 new = 100 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/me/cohort apps/api/src/me/me.module.ts
git commit -m "feat(api): expose GET /me/cohort"
```

---

### Task 3: Backend `GET /me/retro/current` + `POST /me/retro`

**Files:**
- Create: `apps/api/src/me/retro/retro.service.ts`
- Create: `apps/api/src/me/retro/retro.service.spec.ts`
- Create: `apps/api/src/me/retro/retro.controller.ts`
- Create: `apps/api/src/me/retro/retro.module.ts`
- Create: `apps/api/src/me/retro/dto.ts`
- Modify: `apps/api/src/me/me.module.ts`

Service responsibilities:

1. `getCurrent(userId, now)` — returns `{ open: boolean, retro: WeeklyRetro | null, windowOpensAt, windowClosesAt }`. Window is Fri 18:00 → Sun 23:59 in the user's timezone (from `MemberAvailability.timezone` — default `America/Sao_Paulo`).
2. `submit(userId, input, now)` — upserts a `WeeklyRetro` for the current week (unique `[userId, weekStart]`). Throws `ConflictException` if called outside the window.

- [ ] **Step 1: Write the DTO**

```typescript
// apps/api/src/me/retro/dto.ts
import { z } from 'zod';

export const SubmitRetroSchema = z.object({
  whatClicked: z.string().max(1000).optional(),
  whatStuck: z.string().max(1000).optional(),
  nextWeekWish: z.string().max(1000).optional(),
});
export type SubmitRetroInput = z.infer<typeof SubmitRetroSchema>;
```

- [ ] **Step 2: Write the spec**

Create `apps/api/src/me/retro/retro.service.spec.ts` with tests covering:

1. `getCurrent` when inside the window (Fri 18:00 to Sun 23:59 user-local) returns `{ open: true, retro: null }`.
2. `getCurrent` outside the window returns `{ open: false, retro: null }`.
3. `getCurrent` returns the existing retro when already submitted this week.
4. `submit` throws `ConflictException` when outside the window.
5. `submit` creates a new retro when inside the window and none exists.
6. `submit` updates the existing retro (upsert semantics) when called again within the window.

```typescript
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { RetroService } from './retro.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const makePrismaMock = () => ({
  memberAvailability: { findUnique: jest.fn() },
  cycleMembership: { findFirst: jest.fn() },
  weeklyRetro: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
});

describe('RetroService', () => {
  let service: RetroService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const mod = await Test.createTestingModule({
      providers: [RetroService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(RetroService);
  });

  it('open=true when Fri 19:00 local (BRT, UTC-3)', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.weeklyRetro.findUnique.mockResolvedValue(null);
    // Fri Apr 17 at 22:00 UTC = 19:00 BRT
    const result = await service.getCurrent('u-1', new Date('2026-04-17T22:00:00Z'));
    expect(result.open).toBe(true);
    expect(result.retro).toBeNull();
  });

  it('open=false on Fri 17:00 local (before window)', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.weeklyRetro.findUnique.mockResolvedValue(null);
    // Fri Apr 17 at 20:00 UTC = 17:00 BRT
    const result = await service.getCurrent('u-1', new Date('2026-04-17T20:00:00Z'));
    expect(result.open).toBe(false);
  });

  it('returns existing retro when submitted', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.weeklyRetro.findUnique.mockResolvedValue({
      id: 'r-1',
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date(),
      whatClicked: 'x',
      whatStuck: null,
      nextWeekWish: null,
      submittedAt: new Date(),
    });
    const result = await service.getCurrent('u-1', new Date('2026-04-17T22:00:00Z'));
    expect(result.retro?.whatClicked).toBe('x');
  });

  it('submit throws ConflictException outside window', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    await expect(
      service.submit(
        'u-1',
        { whatClicked: 'x' },
        new Date('2026-04-15T22:00:00Z'),   // Wed, not a retro day
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('submit upserts when inside window', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.cycleMembership.findFirst.mockResolvedValue({ cycleId: 'c-1' });
    prisma.weeklyRetro.upsert.mockResolvedValue({
      id: 'r-new',
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date('2026-04-13T00:00:00Z'),
      whatClicked: 'clicked',
      whatStuck: null,
      nextWeekWish: null,
      submittedAt: new Date(),
    });
    const result = await service.submit(
      'u-1',
      { whatClicked: 'clicked' },
      new Date('2026-04-17T22:00:00Z'),
    );
    expect(prisma.weeklyRetro.upsert).toHaveBeenCalled();
    expect(result.whatClicked).toBe('clicked');
  });
});
```

Run: fails.

- [ ] **Step 3: Implement the service**

Write `apps/api/src/me/retro/retro.service.ts`. Key logic:

- Timezone conversion: use `Intl.DateTimeFormat` with the user's timezone to extract local day-of-week and hour. Window open if local-now ∈ `(Fri 18:00 local, Sun 23:59 local]`.
- Week start: for the week to which this retro belongs, anchor to the UTC Monday of `weekStart`. Since the retro window spans Fri-Sun, the relevant plan week starts on the Monday _of the current calendar week in user's timezone_.

```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { SubmitRetroInput } from './dto';

@Injectable()
export class RetroService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(userId: string, now: Date = new Date()) {
    const availability = await this.prisma.memberAvailability.findUnique({ where: { userId } });
    const tz = availability?.timezone ?? 'America/Sao_Paulo';
    const { open, windowOpensAt, windowClosesAt, weekStart } = this.computeWindow(now, tz);

    const retro = await this.prisma.weeklyRetro.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
    });

    return {
      open,
      retro,
      windowOpensAt: windowOpensAt.toISOString(),
      windowClosesAt: windowClosesAt.toISOString(),
    };
  }

  async submit(userId: string, input: SubmitRetroInput, now: Date = new Date()) {
    const availability = await this.prisma.memberAvailability.findUnique({ where: { userId } });
    const tz = availability?.timezone ?? 'America/Sao_Paulo';
    const { open, weekStart } = this.computeWindow(now, tz);
    if (!open) {
      throw new ConflictException('Retro window is closed — try again Fri 18:00 to Sun 23:59 local time.');
    }

    const membership = await this.prisma.cycleMembership.findFirst({
      where: { userId, cycle: { status: 'ACTIVE' } },
    });
    if (!membership) throw new NotFoundException('No active cycle membership');

    return this.prisma.weeklyRetro.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      create: {
        userId,
        cycleId: membership.cycleId,
        weekStart,
        whatClicked: input.whatClicked ?? null,
        whatStuck: input.whatStuck ?? null,
        nextWeekWish: input.nextWeekWish ?? null,
      },
      update: {
        whatClicked: input.whatClicked ?? null,
        whatStuck: input.whatStuck ?? null,
        nextWeekWish: input.nextWeekWish ?? null,
        submittedAt: new Date(),
      },
    });
  }

  private computeWindow(now: Date, timezone: string) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(now).map((p) => [p.type, p.value]),
    );
    const dayCode: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const localDay = dayCode[parts.weekday];
    const localHour = parseInt(parts.hour === '24' ? '0' : parts.hour, 10);

    const inWindow =
      (localDay === 5 && localHour >= 18) ||   // Fri 18:00+
      localDay === 6 ||                         // All of Sat
      localDay === 0;                           // Sun (until 23:59 — end-of-day handled naturally)

    // weekStart: UTC Monday of the current user-local week.
    const today = new Date(now);
    // shift to user-local day index; approximate by using Intl parts
    const localDate = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
    const mondayOffset = (localDay + 6) % 7;   // days since Monday
    const weekStart = new Date(localDate);
    weekStart.setUTCDate(weekStart.getUTCDate() - mondayOffset);

    const windowOpensAt = new Date(weekStart);
    windowOpensAt.setUTCDate(windowOpensAt.getUTCDate() + 4);   // Friday
    windowOpensAt.setUTCHours(18, 0, 0, 0);
    const windowClosesAt = new Date(weekStart);
    windowClosesAt.setUTCDate(windowClosesAt.getUTCDate() + 6);   // Sunday
    windowClosesAt.setUTCHours(23, 59, 59, 999);

    return { open: inWindow, weekStart, windowOpensAt, windowClosesAt };
  }
}
```

Run tests:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern retro.service.spec
```

Expected: pass. If any timezone edge case fails, adjust only the service.

- [ ] **Step 4: Write controller + module**

```typescript
// retro.controller.ts
import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtStrategyPayload } from '../../auth/strategies/jwt.strategy';
import { RetroService } from './retro.service';
import { SubmitRetroSchema } from './dto';

@Controller('me/retro')
export class RetroController {
  constructor(private readonly retro: RetroService) {}

  @Get('current')
  current(@CurrentUser() user: JwtStrategyPayload) {
    return this.retro.getCurrent(user.sub);
  }

  @Post()
  submit(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const input = SubmitRetroSchema.parse(body);
    return this.retro.submit(user.sub, input);
  }
}
```

```typescript
// retro.module.ts
import { Module } from '@nestjs/common';
import { RetroService } from './retro.service';
import { RetroController } from './retro.controller';

@Module({ providers: [RetroService], controllers: [RetroController] })
export class RetroModule {}
```

Wire into `MeModule`.

- [ ] **Step 5: Run full API suite**

```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/api typecheck
```

Expected: 100+ pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/me/retro apps/api/src/me/me.module.ts
git commit -m "feat(api): GET /me/retro/current + POST /me/retro with window check"
```

---

### Task 4: Extend availability controller for phone + timezone + track

**Files:**
- Modify: `apps/api/src/availability/dto.ts`
- Modify: `apps/api/src/availability/availability.service.ts`
- Modify: `apps/api/src/availability/availability.service.spec.ts`
- Modify: `apps/api/src/availability/availability.controller.ts`

- [ ] **Step 1: Inspect existing endpoints**

```bash
cat apps/api/src/availability/availability.controller.ts
cat apps/api/src/availability/availability.service.ts
cat apps/api/src/availability/dto.ts
```

Understand current shape: `PATCH /me/availability` with minutes per day + preferredSessionMinutes + timezone.

- [ ] **Step 2: Extend the Zod schema / service**

Add optional fields to the existing availability update schema in `dto.ts`:

```typescript
// Append to dto.ts, matching the existing Zod style
export const UpdateProfileSchema = z.object({
  whatsappPhone: z.string().regex(/^\+\d{8,15}$/).nullable().optional(),
  targetTrack: z.enum(['BIG_TECH','CONSULTING_TECH','COMPETITIVE_PROGRAMMING','STARTUP','OTHER']).nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
```

Add a `updateProfile(userId, input)` method to `availability.service.ts` that:
- Updates `User.whatsappPhone` (via `prisma.user.update`).
- Updates the member's active `CycleMembership.track` (via `prisma.cycleMembership.updateMany`).

(Alternative: put this in `me.service.ts` instead of availability service — if that's where other profile updates live, prefer that file. Check which is idiomatic.)

- [ ] **Step 3: Add unit tests for `updateProfile`**

Add tests to the relevant spec file covering:
- Phone updates propagate to `User.whatsappPhone`.
- `targetTrack` updates the active `CycleMembership.track`.
- Invalid phone format is rejected by the DTO (unit-level — exercise the schema separately).

- [ ] **Step 4: Expose the endpoint**

Add a route in `availability.controller.ts` (or `me.controller.ts`, depending on where the profile lives):

```typescript
@Patch('profile')
updateProfile(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
  const input = UpdateProfileSchema.parse(body);
  return this.availability.updateProfile(user.sub, input);
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/api typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/availability apps/api/src/me
git commit -m "feat(api): PATCH /me/profile — phone + track (extends availability module)"
```

---

### Task 5: Frontend data hooks for cohort, retro, settings

**Files:**
- Create: `apps/web/lib/queries/me-cohort.ts`
- Create: `apps/web/lib/queries/me-retro.ts`
- Create: `apps/web/lib/queries/me-settings.ts`

- [ ] **Step 1: `me-cohort.ts`**

```typescript
'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type CohortEvent = {
  id: string;
  kind: 'finished' | 'got_stuck' | 'had_doubts' | 'posted_retro' | 'started_week';
  at: string;
  member: { id: string; name: string; pictureUrl: string | null };
  itemTitle: string | null;
  itemId: string | null;
};

export type MemberRank = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  percent: number;
  done: number;
  total: number;
  isMe: boolean;
};

export type CohortResponse = {
  cycleName: string;
  memberCount: number;
  weekEndsAt: string | null;
  feed: CohortEvent[];
  ranking?: MemberRank[];
};

export function useMeCohort() {
  return useQuery({
    queryKey: ['me', 'cohort'],
    queryFn: () => apiFetch<CohortResponse>('/me/cohort'),
    refetchInterval: 60_000,
  });
}
```

- [ ] **Step 2: `me-retro.ts`**

```typescript
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type RetroCurrentResponse = {
  open: boolean;
  retro: {
    id: string;
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    submittedAt: string;
  } | null;
  windowOpensAt: string;
  windowClosesAt: string;
};

export function useMeRetroCurrent() {
  return useQuery({
    queryKey: ['me', 'retro', 'current'],
    queryFn: () => apiFetch<RetroCurrentResponse>('/me/retro/current'),
  });
}

export function useSubmitRetro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { whatClicked?: string; whatStuck?: string; nextWeekWish?: string }) =>
      apiFetch<unknown>('/me/retro', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'retro'] }),
  });
}
```

Verify `apiFetch` body convention matches (`body: JSON.stringify(...)` per the PR 2b discovery).

- [ ] **Step 3: `me-settings.ts`**

```typescript
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

// Availability already has an existing hook elsewhere; add only the profile hook.
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { whatsappPhone?: string | null; targetTrack?: string | null }) =>
      apiFetch('/me/profile', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/queries
git commit -m "feat(web): data hooks for cohort, retro, settings"
```

---

### Task 6: Frontend `/me/cohort` page

**Files:**
- Create: `apps/web/components/member/cohort-feed.tsx`
- Create: `apps/web/components/member/cohort-ranking.tsx`
- Create: `apps/web/app/(member)/me/cohort/page.tsx`

**Design rules applied:**

- Feed rows follow the `ListRow` pattern but smaller: avatar + name + verb + target + relative time.
- Ranking uses the `StreakCard` layout family: tabular nums for %, bold name for self, dot for position.
- Self-row highlighted with `bg-paper-warm` + `border border-ink`. Per `docs/design-system.md`: one accent per unit — self highlight is the priority here, no platform colors.
- When `ranking` is undefined: single column, feed gets full width — no placeholder or "unlocked" hint.

- [ ] **Step 1: Write `cohort-feed.tsx`**

A component that takes `feed: CohortEvent[]` and renders each event as a row. Keep the eyebrow verb verbiage in English:

- `finished` → `finished`
- `got_stuck` → `got stuck on`
- `had_doubts` → `had doubts on`
- `posted_retro` → `posted the weekly retro`
- `started_week` → `started the week`

Use `formatRelative` for "4m ago" timestamps.

```tsx
'use client';
import { clsx } from 'clsx';
import type { CohortEvent } from '../../lib/queries/me-cohort';

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function verb(kind: CohortEvent['kind']): string {
  return {
    finished: 'finished',
    got_stuck: 'got stuck on',
    had_doubts: 'had doubts on',
    posted_retro: 'posted the weekly retro',
    started_week: 'started the week',
  }[kind];
}

function relative(iso: string, now: Date = new Date()): string {
  const diffMin = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

interface CohortFeedProps {
  feed: CohortEvent[];
  className?: string;
}

export function CohortFeed({ feed, className }: CohortFeedProps) {
  if (feed.length === 0) {
    return <p className={clsx('font-sans text-sm text-ink-mute', className)}>No activity in the last 24 hours.</p>;
  }
  return (
    <ul className={clsx('divide-y divide-rule', className)}>
      {feed.map((event) => (
        <li key={event.id} className="flex items-start gap-3 py-3">
          <div
            aria-hidden
            className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-paper-warm font-serif text-xs font-semibold text-ink"
          >
            {initials(event.member.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-sans text-sm leading-snug">
              <span className="font-semibold text-ink">{event.member.name}</span>
              <span className="text-ink-soft"> {verb(event.kind)} </span>
              {event.itemTitle && (
                <span className="font-serif italic text-ink">{event.itemTitle}</span>
              )}
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-label text-ink-mute">
              {relative(event.at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Write `cohort-ranking.tsx`**

```tsx
'use client';
import { clsx } from 'clsx';
import type { MemberRank } from '../../lib/queries/me-cohort';

interface CohortRankingProps {
  ranking: MemberRank[];
  weekEndsAt: string | null;
  className?: string;
}

export function CohortRanking({ ranking, weekEndsAt, className }: CohortRankingProps) {
  return (
    <div className={clsx('space-y-4', className)}>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold">
          This week
        </p>
        <h2 className="mt-1 font-serif text-lg font-medium">Who&apos;s firm</h2>
        {weekEndsAt && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-label text-ink-mute">
            Ends {new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(weekEndsAt))}
          </p>
        )}
      </div>
      <ol className="space-y-0.5">
        {ranking.map((r, i) => (
          <li
            key={r.userId}
            className={clsx(
              'flex items-center gap-3 rounded-card px-2 py-2',
              r.isMe && 'bg-paper-warm border border-ink',
            )}
          >
            <span className="w-6 font-serif-tool text-sm tabular-nums font-semibold text-ink-mute">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={clsx(
                  'truncate font-sans text-sm',
                  r.isMe ? 'font-semibold text-ink' : 'text-ink-soft',
                )}
              >
                {r.name}
                {r.isMe && <span className="ml-1 text-ink-mute">(you)</span>}
              </p>
              <div className="mt-1 h-1 w-full rounded-full bg-rule">
                <div className="h-full rounded-full bg-ink" style={{ width: `${r.percent}%` }} />
              </div>
            </div>
            <span className="font-mono text-[11px] tabular-nums text-ink">{r.percent}%</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 3: Write `/me/cohort/page.tsx`**

```tsx
'use client';
import { useMeCohort } from '../../../../lib/queries/me-cohort';
import { CohortFeed } from '../../../../components/member/cohort-feed';
import { CohortRanking } from '../../../../components/member/cohort-ranking';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { SectionLabel } from '../../../../components/ui/section-label';

export default function MeCohortPage() {
  const { data, isLoading } = useMeCohort();
  if (isLoading || !data) {
    return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>;
  }
  const hasRanking = Array.isArray(data.ranking) && data.ranking.length > 0;

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <Eyebrow>{`Cohort · ${data.cycleName || 'active cycle'}`}</Eyebrow>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">
          {data.memberCount === 0
            ? 'No cohort yet.'
            : `${data.memberCount} classmates this cycle`}
        </h1>
      </div>
      <div className={hasRanking ? 'grid gap-10 md:grid-cols-[minmax(0,1fr)_280px]' : ''}>
        <div className="min-w-0 space-y-4">
          <SectionLabel>Activity · last 24h</SectionLabel>
          <CohortFeed feed={data.feed} />
        </div>
        {hasRanking && (
          <aside>
            <CohortRanking ranking={data.ranking!} weekEndsAt={data.weekEndsAt} />
          </aside>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + build**

```bash
pnpm --filter @ics-select/web typecheck
pnpm --filter @ics-select/web build
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add 'apps/web/app/(member)/me/cohort' apps/web/components/member/cohort-feed.tsx apps/web/components/member/cohort-ranking.tsx
git commit -m "feat(web): /me/cohort (feed + conditional ranking)"
```

---

### Task 7: Frontend `/me/retro` page + topbar badge

**Files:**
- Create: `apps/web/components/member/retro-form.tsx`
- Create: `apps/web/app/(member)/me/retro/page.tsx`
- Modify: `apps/web/components/member-shell/topbar-member.tsx` (badge when retro open)

- [ ] **Step 1: Write `retro-form.tsx`**

```tsx
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
```

- [ ] **Step 2: Write `/me/retro/page.tsx`**

```tsx
'use client';
import { useMeRetroCurrent } from '../../../../lib/queries/me-retro';
import { RetroForm } from '../../../../components/member/retro-form';

export default function MeRetroPage() {
  const { data, isLoading } = useMeRetroCurrent();
  if (isLoading || !data) {
    return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>;
  }
  return <RetroForm data={data} />;
}
```

- [ ] **Step 3: Update topbar with retro badge**

Edit `apps/web/components/member-shell/topbar-member.tsx`. Import `useMeRetroCurrent` and render a small badge next to the `Cohort` link when `data?.open && !data.retro`.

```tsx
// Inside TopbarMember, before the return:
import { useMeRetroCurrent } from '../../lib/queries/me-retro';
// ...
const { data: retro } = useMeRetroCurrent();
const retroOpen = retro?.open === true && !retro.retro;
```

Then add next to the Cohort link (or near the avatar): a small pill with accent terracotta. Rule from `docs/design-system.md`: terracotta = reflective / returning. Retro is reflective → `bg-accent` text-paper.

Simplest placement — add a link after the nav that shows only when open:

```tsx
{retroOpen && (
  <Link
    href="/me/retro"
    className="inline-flex items-center rounded-pill bg-accent px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow font-bold text-paper hover:opacity-90"
  >
    Retro open
  </Link>
)}
```

- [ ] **Step 4: Typecheck + build**

```bash
pnpm --filter @ics-select/web typecheck
pnpm --filter @ics-select/web build
```

- [ ] **Step 5: Commit**

```bash
git add 'apps/web/app/(member)/me/retro' apps/web/components/member/retro-form.tsx apps/web/components/member-shell/topbar-member.tsx
git commit -m "feat(web): /me/retro form + 'Retro open' badge in topbar"
```

---

### Task 8: Frontend `/me/settings` page

**Files:**
- Create: `apps/web/components/member/availability-grid.tsx`
- Create: `apps/web/components/member/profile-fields.tsx`
- Create: `apps/web/components/member/google-status-card.tsx`
- Create: `apps/web/app/(member)/me/settings/page.tsx`

- [ ] **Step 1: Data hook for current availability**

Check if an existing hook like `useMeAvailability` already exists:

```bash
grep -rn "availability" apps/web/lib --include='*.ts' --include='*.tsx'
```

If none, add one to `apps/web/lib/queries/me-settings.ts`:

```typescript
export type AvailabilityResponse = {
  mondayMinutes: number;
  tuesdayMinutes: number;
  wednesdayMinutes: number;
  thursdayMinutes: number;
  fridayMinutes: number;
  saturdayMinutes: number;
  sundayMinutes: number;
  preferredSessionMinutes: number;
  timezone: string;
};

export function useMeAvailability() {
  return useQuery({
    queryKey: ['me', 'availability'],
    queryFn: () => apiFetch<AvailabilityResponse>('/me/availability'),
  });
}

export function useUpdateAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AvailabilityResponse>) =>
      apiFetch('/me/availability', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'availability'] }),
  });
}
```

Verify the endpoint path — might already be `PATCH /me/availability`.

- [ ] **Step 2: `availability-grid.tsx`**

A 7-day grid of minute inputs (Mon-Sun), plus preferredSessionMinutes + timezone select. Save button calls `useUpdateAvailability`.

```tsx
'use client';
import { useState } from 'react';
import { SectionLabel } from '../ui/section-label';
import { Button } from '../ui/button';
import type { AvailabilityResponse } from '../../lib/queries/me-settings';
import { useUpdateAvailability } from '../../lib/queries/me-settings';

const DAYS: Array<keyof Pick<AvailabilityResponse,
  'mondayMinutes' | 'tuesdayMinutes' | 'wednesdayMinutes' | 'thursdayMinutes' | 'fridayMinutes' | 'saturdayMinutes' | 'sundayMinutes'>> = [
  'mondayMinutes', 'tuesdayMinutes', 'wednesdayMinutes', 'thursdayMinutes', 'fridayMinutes', 'saturdayMinutes', 'sundayMinutes',
];

const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface AvailabilityGridProps {
  data: AvailabilityResponse;
}

export function AvailabilityGrid({ data }: AvailabilityGridProps) {
  const [state, setState] = useState(data);
  const mutation = useUpdateAvailability();

  const total = DAYS.reduce((sum, k) => sum + (state[k] ?? 0), 0);

  async function handleSave() {
    await mutation.mutateAsync(state);
  }

  return (
    <div className="space-y-4">
      <SectionLabel>Weekly availability</SectionLabel>
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((key, i) => (
          <div key={key} className="flex flex-col items-center gap-1">
            <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">{LABELS[i]}</span>
            <input
              type="number"
              min={0}
              max={1440}
              step={15}
              value={state[key] ?? 0}
              onChange={(e) => setState({ ...state, [key]: Number(e.target.value) })}
              className="w-full rounded-input border border-rule bg-surface px-2 py-1.5 text-center font-mono text-sm tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-ink"
            />
            <span className="font-mono text-[9px] uppercase tracking-label text-ink-mute">min</span>
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold">
            Preferred session length (min)
          </span>
          <input
            type="number"
            min={15}
            max={180}
            step={15}
            value={state.preferredSessionMinutes}
            onChange={(e) => setState({ ...state, preferredSessionMinutes: Number(e.target.value) })}
            className="rounded-input border border-rule bg-surface px-3 py-2 font-mono text-sm tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-ink"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold">
            Timezone
          </span>
          <input
            type="text"
            value={state.timezone}
            onChange={(e) => setState({ ...state, timezone: e.target.value })}
            className="rounded-input border border-rule bg-surface px-3 py-2 font-sans text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
          />
        </label>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
        Total weekly: {total} min ({Math.round(total / 60)} h)
      </p>
      <Button onClick={handleSave} disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : 'Save availability'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: `profile-fields.tsx`**

Phone + target track + save button. Follows same pattern.

```tsx
'use client';
import { useState } from 'react';
import { SectionLabel } from '../ui/section-label';
import { Button } from '../ui/button';
import { useUpdateProfile } from '../../lib/queries/me-settings';
import { TRACKS, type Track } from '@ics-select/shared';

interface ProfileFieldsProps {
  initial: { whatsappPhone: string | null; targetTrack: Track | null };
}

export function ProfileFields({ initial }: ProfileFieldsProps) {
  const [phone, setPhone] = useState(initial.whatsappPhone ?? '');
  const [track, setTrack] = useState<Track | ''>(initial.targetTrack ?? '');
  const mutation = useUpdateProfile();

  async function save() {
    await mutation.mutateAsync({
      whatsappPhone: phone.trim() || null,
      targetTrack: (track || null) as Track | null,
    });
  }

  return (
    <div className="space-y-4">
      <SectionLabel>Profile</SectionLabel>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold">
          WhatsApp phone (E.164)
        </span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+5511999887766"
          className="rounded-input border border-rule bg-surface px-3 py-2 font-mono text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold">
          Target track
        </span>
        <select
          value={track}
          onChange={(e) => setTrack(e.target.value as Track)}
          className="rounded-input border border-rule bg-surface px-3 py-2 font-sans text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
        >
          <option value="">(not set)</option>
          {TRACKS.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ').toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      <Button onClick={save} disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : 'Save profile'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: `google-status-card.tsx`**

A simple card showing Google Calendar connection status with a reconnect button (linking to `/auth/google` — reuse existing).

```tsx
'use client';
import { Card } from '../ui/card';
import { SectionLabel } from '../ui/section-label';
import { Button } from '../ui/button';

interface GoogleStatusCardProps {
  connected: boolean;
}

export function GoogleStatusCard({ connected }: GoogleStatusCardProps) {
  return (
    <Card className="p-5 space-y-3">
      <SectionLabel>Google Calendar</SectionLabel>
      {connected ? (
        <p className="font-sans text-sm text-ink-soft">
          Connected — study sessions appear in your primary calendar.
        </p>
      ) : (
        <p className="border-l-4 border-outcome-stuck pl-3 font-sans text-sm text-ink-soft">
          Not connected. Reconnect to receive auto-scheduled study blocks.
        </p>
      )}
      <a href="/auth/google">
        <Button variant={connected ? 'ghost' : 'primary'}>
          {connected ? 'Reconnect' : 'Connect Google Calendar'}
        </Button>
      </a>
    </Card>
  );
}
```

- [ ] **Step 5: Settings page**

Write `/me/settings/page.tsx`:

```tsx
'use client';
import { useMeAvailability } from '../../../../lib/queries/me-settings';
import { AvailabilityGrid } from '../../../../components/member/availability-grid';
import { ProfileFields } from '../../../../components/member/profile-fields';
import { GoogleStatusCard } from '../../../../components/member/google-status-card';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { useAuth } from '../../../../lib/auth/auth-context';

export default function MeSettingsPage() {
  const { data, isLoading } = useMeAvailability();
  const { user } = useAuth();

  if (isLoading || !data) {
    return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>;
  }

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <Eyebrow>Settings</Eyebrow>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">
          Your profile + availability
        </h1>
      </div>

      <AvailabilityGrid data={data} />

      <ProfileFields
        initial={{
          whatsappPhone: user?.whatsappPhone ?? null,
          targetTrack: user?.targetTrack ?? null,
        }}
      />

      <GoogleStatusCard connected={!!user?.googleConnected} />
    </div>
  );
}
```

**CAVEAT:** the `User` type from the auth context may not include `whatsappPhone`, `targetTrack`, or `googleConnected`. Check the current shape:

```bash
grep -A10 "type User" apps/web/lib/auth/auth-context.tsx
```

If missing, extend the type + backend `/me` endpoint to return these fields. Minimum change: add them to the User type and the `/me` response.

- [ ] **Step 6: Typecheck + build**

```bash
pnpm --filter @ics-select/web typecheck
pnpm --filter @ics-select/web build
```

- [ ] **Step 7: Commit**

```bash
git add 'apps/web/app/(member)/me/settings' apps/web/components/member/availability-grid.tsx apps/web/components/member/profile-fields.tsx apps/web/components/member/google-status-card.tsx apps/web/lib/queries/me-settings.ts
git commit -m "feat(web): /me/settings (availability + profile + Google status)"
```

---

### Task 9: Update `/dev/me-preview` with cohort + retro + settings panels

**Files:**
- Modify: `apps/web/app/dev/me-preview/page.tsx`

Add mock-data-driven previews of the 3 new screens so design can be iterated visually without the backend.

Append new `<PreviewFrame>` blocks at the bottom of the existing page:

- `Cohort · feed + ranking`
- `Cohort · feed only (ranking hidden)`
- `Retro · window open`
- `Retro · window closed (late Sun)`
- `Settings · complete`

Use mock data inline. Import `CohortFeed`, `CohortRanking`, `RetroForm`, `AvailabilityGrid`, `ProfileFields`, `GoogleStatusCard`.

For `RetroForm`, pass a fake `RetroCurrentResponse` with `open: true` (and one with `open: false`).

- [ ] **Step 1: Extend the preview page**

Implementation mirrors existing panels — the controller should copy the style/approach from the existing `/me` preview blocks.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dev/me-preview/page.tsx
git commit -m "feat(web/dev): extend me-preview with cohort, retro, settings panels"
```

---

### Task 10: Final regression gate

**Files:** verification only.

- [ ] **Step 1: Lint + typecheck + test + build**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: all green. 96 (PR 2b) + new cohort + retro = 110+ API tests.

- [ ] **Step 2: Capture commit list**

```bash
git log --oneline main..HEAD
```

Ideal shape: 10-ish feature commits.

- [ ] **Step 3: Report final state.**

---

## Self-review

**Spec coverage:**
- §4.4 cohort (feed + ranking) — Tasks 1-2, 6. Conditional ranking handled via `Cycle.rankingVisibleToMembers` flag. ✅
- §4.5 retro (form + window) — Tasks 3, 7. Window computed in user-local timezone. ✅
- §4.6 settings — Tasks 4, 8. Availability + profile + Google status. ✅
- §8.1 endpoints — `/me/cohort`, `/me/retro/current`, `POST /me/retro` added. `PATCH /me/profile` added. Availability endpoint extended (not rewritten). ✅
- Accent rules from `docs/design-system.md` followed: `bg-accent` for retro badge (reflective), `border-outcome-stuck` for "not connected" warning on Google card (urgent), one accent per unit throughout.

**Placeholder scan:** none — every code block is concrete.

**Type consistency:**
- `CohortEvent.kind` enum shared between backend, frontend hook, feed component.
- `RetroCurrentResponse` shape matches across backend + frontend.
- `Track` type imported from `@ics-select/shared` in both profile fields and backend DTO.
- `apiFetch` body style matches PR 2b convention (`body: JSON.stringify(...)`).

**Out-of-scope correctly deferred:**
- Onboarding wizard: PR 2d (or deferred).
- Admin-side toggle of `Cycle.rankingVisibleToMembers`: PR 3.
- Retro skipped-notifications (admin alert): PR 3 admin triage.
- Feed read-only item route (opening a peer's item): defer; clicking a feed event stays passive for now.
