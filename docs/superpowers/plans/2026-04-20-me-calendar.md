# `/me/calendar` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the member `/me/plan` list with `/me/calendar`, a Google-synced FullCalendar week-grid that distinguishes ICS study blocks (with platform stripe + outcome dot) from external events (paper-warm neutral, read-only), and lets members drag ICS blocks to reschedule.

**Architecture:** New `me/calendar` NestJS module exposing `GET /me/calendar?weekStart=…` (classified + enriched events) and `PATCH /me/calendar/events/:id` (ICS-only reschedule). Web page composes FullCalendar `timeGridWeek` with custom `eventContent` for each kind. Source of truth stays Google Calendar; all ICS detection is via the existing `ICS ID:` marker in event descriptions.

**Tech Stack:** NestJS 10 + Jest, Next.js 15 App Router + TanStack Query + HeroUI + FullCalendar (`@fullcalendar/react` + `@fullcalendar/timegrid` + `@fullcalendar/interaction`), Tailwind 3 (Magazine Editorial tokens).

**Design spec:** `docs/superpowers/specs/2026-04-20-me-calendar-design.md`

---

## Prerequisites

- Worktree is clean before starting.
- `pnpm install` already done in the repo.
- Postgres is up (`docker compose up -d postgres`) if you want to exercise the API against real data — not required for unit tests.

---

### Task 1: Install FullCalendar dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install deps**

```bash
pnpm --filter @ics-select/web add @fullcalendar/core@^6.1.15 @fullcalendar/react@^6.1.15 @fullcalendar/timegrid@^6.1.15 @fullcalendar/interaction@^6.1.15
```

- [ ] **Step 2: Verify they landed**

Run: `pnpm --filter @ics-select/web list @fullcalendar/react`
Expected: a line like `@fullcalendar/react 6.1.x`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add FullCalendar deps for /me/calendar"
```

---

### Task 2: Extend `GoogleCalendarService.listEventsInRange` to return richer event data

**Rationale:** The existing method filters out all-day events and returns only `{id, summary, description, start, end}`. Calendar UI needs `allDay`, `location`, `htmlLink`, and `conferenceData.entryPoints[].uri` (Meet link). The filter must be opt-in so the `reminders.cron` consumer is unaffected.

**Files:**
- Modify: `apps/api/src/google-calendar/google-calendar.service.ts`
- Modify: `apps/api/src/google-calendar/google-calendar.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Append to `apps/api/src/google-calendar/google-calendar.service.spec.ts` (inside the existing `describe('GoogleCalendarService', ...)` block):

```ts
  describe('listEventsInRange — extended fields', () => {
    it('returns allDay=false, location, htmlLink, meetLink for timed events', async () => {
      calendarApi.events.list = jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'e1',
              summary: 'Study',
              description: 'ICS ID: p1/i1',
              start: { dateTime: '2026-04-20T14:00:00Z' },
              end: { dateTime: '2026-04-20T15:00:00Z' },
              location: 'Room A',
              htmlLink: 'https://calendar.google.com/event?eid=abc',
              conferenceData: {
                entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/xyz' }],
              },
            },
          ],
        },
      });
      const out = await service.listEventsInRange(
        'user-1',
        new Date('2026-04-20T00:00:00Z'),
        new Date('2026-04-21T00:00:00Z'),
      );
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        id: 'e1',
        allDay: false,
        location: 'Room A',
        htmlLink: 'https://calendar.google.com/event?eid=abc',
        meetLink: 'https://meet.google.com/xyz',
      });
    });

    it('includes all-day events when includeAllDay=true', async () => {
      calendarApi.events.list = jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'allday-1',
              summary: 'Trip LA',
              description: '',
              start: { date: '2026-04-22' },
              end: { date: '2026-04-23' },
            },
          ],
        },
      });
      const out = await service.listEventsInRange(
        'user-1',
        new Date('2026-04-20T00:00:00Z'),
        new Date('2026-04-27T00:00:00Z'),
        { includeAllDay: true },
      );
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ id: 'allday-1', allDay: true });
    });

    it('excludes all-day events by default (backward compat)', async () => {
      calendarApi.events.list = jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'allday-1',
              summary: 'Trip LA',
              start: { date: '2026-04-22' },
              end: { date: '2026-04-23' },
            },
          ],
        },
      });
      const out = await service.listEventsInRange(
        'user-1',
        new Date('2026-04-20T00:00:00Z'),
        new Date('2026-04-27T00:00:00Z'),
      );
      expect(out).toHaveLength(0);
    });
  });
```

Note: the existing spec file may already define a `calendarApi` mock via the `clientFactory`. If the variable name differs, adapt the snippet — do not introduce a second mock. Read the file first.

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern google-calendar.service`
Expected: FAIL — `Expected 'Room A' ... Received undefined` (location/htmlLink/meetLink/allDay don't exist on the returned shape yet) or `Expected 1 length ... Received 0` for the all-day test.

- [ ] **Step 3: Update the service**

Replace the current `listEventsInRange` in `apps/api/src/google-calendar/google-calendar.service.ts` with:

```ts
  async listEventsInRange(
    userId: string,
    timeMin: Date,
    timeMax: Date,
    opts: { includeAllDay?: boolean } = {},
  ): Promise<Array<{
    id: string;
    summary: string;
    description: string;
    start: Date;
    end: Date;
    allDay: boolean;
    location?: string;
    htmlLink?: string;
    meetLink?: string;
  }>> {
    const client = await this.clientFor(userId);
    const res = await client.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    const events = res.data.items ?? [];
    const includeAllDay = opts.includeAllDay === true;
    return events
      .filter((e) => {
        if (!e.id) return false;
        const hasDateTime = e.start?.dateTime && e.end?.dateTime;
        const hasDateOnly = e.start?.date && e.end?.date;
        if (hasDateTime) return true;
        if (hasDateOnly) return includeAllDay;
        return false;
      })
      .map((e) => {
        const allDay = !e.start?.dateTime;
        const start = allDay
          ? new Date(e.start!.date + 'T00:00:00')
          : new Date(e.start!.dateTime!);
        const end = allDay
          ? new Date(e.end!.date + 'T00:00:00')
          : new Date(e.end!.dateTime!);
        const meetLink = (e.conferenceData?.entryPoints ?? []).find(
          (p) => p.entryPointType === 'video',
        )?.uri;
        return {
          id: e.id!,
          summary: e.summary ?? '',
          description: e.description ?? '',
          start,
          end,
          allDay,
          location: e.location ?? undefined,
          htmlLink: e.htmlLink ?? undefined,
          meetLink: meetLink ?? undefined,
        };
      });
  }
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern google-calendar.service`
Expected: all tests PASS, including the existing tests for the old shape (additive changes).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/google-calendar/google-calendar.service.ts apps/api/src/google-calendar/google-calendar.service.spec.ts
git commit -m "feat(api): enrich listEventsInRange with allDay/location/htmlLink/meetLink"
```

---

### Task 3: Add `rescheduleEvent` method to `GoogleCalendarService`

**Rationale:** The existing `updateEvent` requires the full `CreateEventInput` (summary, description, start, end) and will overwrite summary/description. For drag-to-reschedule we only want to patch time. A separate method keeps the contract clear.

**Files:**
- Modify: `apps/api/src/google-calendar/google-calendar.service.ts`
- Modify: `apps/api/src/google-calendar/google-calendar.service.spec.ts`

- [ ] **Step 1: Write failing test**

Append inside the existing describe block:

```ts
  describe('rescheduleEvent', () => {
    it('patches only start and end on the primary calendar', async () => {
      calendarApi.events.patch = jest.fn().mockResolvedValue({ data: {} });
      await service.rescheduleEvent(
        'user-1',
        'event-1',
        new Date('2026-04-20T14:00:00Z'),
        new Date('2026-04-20T15:00:00Z'),
      );
      expect(calendarApi.events.patch).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId: 'event-1',
        requestBody: {
          start: { dateTime: '2026-04-20T14:00:00.000Z' },
          end: { dateTime: '2026-04-20T15:00:00.000Z' },
        },
      });
    });
  });
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern google-calendar.service`
Expected: FAIL — `service.rescheduleEvent is not a function`.

- [ ] **Step 3: Add the method**

In `apps/api/src/google-calendar/google-calendar.service.ts`, add (right below the existing `updateEvent` method):

```ts
  async rescheduleEvent(
    userId: string,
    eventId: string,
    start: Date,
    end: Date,
  ): Promise<void> {
    const client = await this.clientFor(userId);
    await client.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    });
  }
```

- [ ] **Step 4: Verify tests pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern google-calendar.service`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/google-calendar/google-calendar.service.ts apps/api/src/google-calendar/google-calendar.service.spec.ts
git commit -m "feat(api): add GoogleCalendarService.rescheduleEvent (patch start/end only)"
```

---

### Task 4: Scaffold `MeCalendarService` + classification tests

**Files:**
- Create: `apps/api/src/me/calendar/calendar.module.ts`
- Create: `apps/api/src/me/calendar/calendar.service.ts`
- Create: `apps/api/src/me/calendar/calendar.service.spec.ts`
- Modify: `apps/api/src/me/me.module.ts`

- [ ] **Step 1: Write failing tests (classification + no-connection fallback)**

Create `apps/api/src/me/calendar/calendar.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { GoogleCalendarService } from '../../google-calendar/google-calendar.service.js';
import { MeCalendarService } from './calendar.service.js';

const makeGcalMock = () => ({
  listEventsInRange: jest.fn(),
  rescheduleEvent: jest.fn(),
});

const makePrismaMock = () => ({
  googleAccount: { findUnique: jest.fn() },
  weeklyPlanItem: { findMany: jest.fn() },
  memberAvailability: { findUnique: jest.fn() },
});

describe('MeCalendarService', () => {
  let service: MeCalendarService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let gcal: ReturnType<typeof makeGcalMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    gcal = makeGcalMock();
    const mod = await Test.createTestingModule({
      providers: [
        MeCalendarService,
        { provide: PrismaService, useValue: prisma },
        { provide: GoogleCalendarService, useValue: gcal },
      ],
    }).compile();
    service = mod.get(MeCalendarService);
  });

  describe('getWeek', () => {
    const weekStart = new Date('2026-04-19T00:00:00-03:00'); // Sunday in São Paulo

    it('returns hasGoogleConnection=false when no GoogleAccount', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue(null);
      prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
      const result = await service.getWeek('user-1', weekStart);
      expect(result.hasGoogleConnection).toBe(false);
      expect(result.events).toEqual([]);
      expect(gcal.listEventsInRange).not.toHaveBeenCalled();
    });

    it('returns hasGoogleConnection=false when listEventsInRange throws invalid_grant', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
      gcal.listEventsInRange.mockRejectedValue(new Error('invalid_grant: token revoked'));
      const result = await service.getWeek('user-1', weekStart);
      expect(result.hasGoogleConnection).toBe(false);
      expect(result.events).toEqual([]);
    });

    it('classifies events with ICS ID marker as kind=ICS, others as EXTERNAL', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
      gcal.listEventsInRange.mockResolvedValue([
        {
          id: 'e-ics',
          summary: 'Two pointers',
          description: 'study · leetcode\nICS ID: plan-1/item-1',
          start: new Date('2026-04-20T14:00:00Z'),
          end: new Date('2026-04-20T14:30:00Z'),
          allDay: false,
        },
        {
          id: 'e-ext',
          summary: 'Team standup',
          description: 'Daily sync',
          start: new Date('2026-04-20T13:00:00Z'),
          end: new Date('2026-04-20T13:15:00Z'),
          allDay: false,
        },
      ]);
      prisma.weeklyPlanItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          weeklyPlanId: 'plan-1',
          outcome: 'PENDING',
          libraryItem: {
            url: 'https://leetcode.com/problems/two-sum',
            format: 'PROBLEM',
            topics: [
              { isPrimary: true, topic: { slug: 'array', label: 'Arrays' } },
            ],
          },
        },
      ]);

      const result = await service.getWeek('user-1', weekStart);

      expect(result.hasGoogleConnection).toBe(true);
      expect(result.events).toHaveLength(2);
      const ics = result.events.find((e) => e.kind === 'ICS')!;
      const ext = result.events.find((e) => e.kind === 'EXTERNAL')!;
      expect(ics.id).toBe('e-ics');
      expect(ics.ics).toMatchObject({
        planId: 'plan-1',
        itemId: 'item-1',
        url: 'https://leetcode.com/problems/two-sum',
        format: 'PROBLEM',
        outcome: 'PENDING',
        topic: { slug: 'array', label: 'Arrays' },
      });
      expect(ext.id).toBe('e-ext');
      expect(ext.ics).toBeUndefined();
    });

    it('downgrades orphan ICS events (itemId missing in DB) to EXTERNAL', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
      gcal.listEventsInRange.mockResolvedValue([
        {
          id: 'e-orphan',
          summary: 'Deleted study block',
          description: 'ICS ID: plan-1/item-GONE',
          start: new Date('2026-04-20T14:00:00Z'),
          end: new Date('2026-04-20T14:30:00Z'),
          allDay: false,
        },
      ]);
      prisma.weeklyPlanItem.findMany.mockResolvedValue([]); // not found

      const result = await service.getWeek('user-1', weekStart);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].kind).toBe('EXTERNAL');
      expect(result.events[0].ics).toBeUndefined();
    });

    it('uses MemberAvailability.timezone, falling back to America/Sao_Paulo', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.memberAvailability.findUnique.mockResolvedValue(null);
      gcal.listEventsInRange.mockResolvedValue([]);
      const result = await service.getWeek('user-1', weekStart);
      expect(result.timezone).toBe('America/Sao_Paulo');
    });

    it('includes all-day events (passes includeAllDay=true)', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
      gcal.listEventsInRange.mockResolvedValue([]);
      await service.getWeek('user-1', weekStart);
      expect(gcal.listEventsInRange).toHaveBeenCalledWith(
        'user-1',
        expect.any(Date),
        expect.any(Date),
        { includeAllDay: true },
      );
    });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern calendar.service`
Expected: FAIL — `Cannot find module './calendar.service.js'`.

- [ ] **Step 3: Create the module + service**

Create `apps/api/src/me/calendar/calendar.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MeCalendarService } from './calendar.service.js';

@Module({
  providers: [MeCalendarService],
  exports: [MeCalendarService],
})
export class MeCalendarModule {}
```

Create `apps/api/src/me/calendar/calendar.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import type { ItemOutcome, ItemFormat } from '@ics-select/prisma';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { GoogleCalendarService } from '../../google-calendar/google-calendar.service.js';
import { extractIcsId } from '../../common/ics-id/ics-id.js';

const DEFAULT_TZ = 'America/Sao_Paulo';

export type CalendarEvent = {
  id: string;
  kind: 'ICS' | 'EXTERNAL';
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  meetLink?: string;
  htmlLink?: string;
  ics?: {
    planId: string;
    itemId: string;
    url: string | null;
    format: ItemFormat;
    topic: { slug: string; label: string } | null;
    outcome: ItemOutcome;
  };
};

export type GetWeekResponse = {
  weekStart: string;
  weekEnd: string;
  timezone: string;
  hasGoogleConnection: boolean;
  events: CalendarEvent[];
};

function isInvalidGrant(err: unknown): boolean {
  const msg = (err as { message?: string })?.message ?? String(err);
  return msg.includes('invalid_grant') || msg.includes('Invalid Credentials');
}

@Injectable()
export class MeCalendarService {
  private readonly logger = new Logger(MeCalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gcal: GoogleCalendarService,
  ) {}

  async getWeek(userId: string, weekStart: Date): Promise<GetWeekResponse> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const availability = await this.prisma.memberAvailability.findUnique({
      where: { userId },
    });
    const timezone = availability?.timezone ?? DEFAULT_TZ;

    const googleAccount = await this.prisma.googleAccount.findUnique({
      where: { userId },
    });

    const base = {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      timezone,
    };

    if (!googleAccount) {
      return { ...base, hasGoogleConnection: false, events: [] };
    }

    let raw: Awaited<ReturnType<typeof this.gcal.listEventsInRange>>;
    try {
      raw = await this.gcal.listEventsInRange(userId, weekStart, weekEnd, {
        includeAllDay: true,
      });
    } catch (err) {
      if (isInvalidGrant(err)) {
        this.logger.warn(`calendar: invalid_grant for user ${userId}`);
        return { ...base, hasGoogleConnection: false, events: [] };
      }
      throw err;
    }

    // Extract itemIds from events that have an ICS ID marker.
    const itemIds: string[] = [];
    const icsByEventId = new Map<string, { planId: string; itemId: string }>();
    for (const e of raw) {
      const parsed = extractIcsId(e.description);
      if (parsed) {
        itemIds.push(parsed.itemId);
        icsByEventId.set(e.id, parsed);
      }
    }

    // Batch-fetch plan items for enrichment.
    const items =
      itemIds.length > 0
        ? await this.prisma.weeklyPlanItem.findMany({
            where: { id: { in: itemIds } },
            select: {
              id: true,
              weeklyPlanId: true,
              outcome: true,
              libraryItem: {
                select: {
                  url: true,
                  format: true,
                  topics: {
                    select: {
                      isPrimary: true,
                      topic: { select: { slug: true, label: true } },
                    },
                  },
                },
              },
            },
          })
        : [];

    const itemMap = new Map(items.map((it) => [it.id, it] as const));

    const events: CalendarEvent[] = raw.map((e) => {
      const ids = icsByEventId.get(e.id);
      const matched = ids ? itemMap.get(ids.itemId) : undefined;

      if (ids && matched) {
        const primary = matched.libraryItem.topics.find((t) => t.isPrimary);
        return {
          id: e.id,
          kind: 'ICS',
          title: e.summary,
          start: e.start.toISOString(),
          end: e.end.toISOString(),
          allDay: e.allDay,
          location: e.location,
          meetLink: e.meetLink,
          htmlLink: e.htmlLink,
          ics: {
            planId: ids.planId,
            itemId: ids.itemId,
            url: matched.libraryItem.url ?? null,
            format: matched.libraryItem.format,
            topic: primary
              ? { slug: primary.topic.slug, label: primary.topic.label }
              : null,
            outcome: matched.outcome,
          },
        };
      }

      return {
        id: e.id,
        kind: 'EXTERNAL',
        title: e.summary,
        start: e.start.toISOString(),
        end: e.end.toISOString(),
        allDay: e.allDay,
        location: e.location,
        meetLink: e.meetLink,
        htmlLink: e.htmlLink,
      };
    });

    return { ...base, hasGoogleConnection: true, events };
  }
}
```

- [ ] **Step 4: Wire the module into `MeModule`**

Edit `apps/api/src/me/me.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';
import { HomeModule } from './home/home.module.js';
import { ItemModule } from './item/item.module.js';
import { CohortModule } from './cohort/cohort.module.js';
import { RetroModule } from './retro/retro.module.js';
import { MeCalendarModule } from './calendar/calendar.module.js';

@Module({
  imports: [HomeModule, ItemModule, CohortModule, RetroModule, MeCalendarModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern calendar.service`
Expected: all 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/me/calendar/ apps/api/src/me/me.module.ts
git commit -m "feat(api): MeCalendarService.getWeek — classify + enrich GCal events"
```

---

### Task 5: Add `reschedule` method to `MeCalendarService`

**Files:**
- Modify: `apps/api/src/me/calendar/calendar.service.ts`
- Modify: `apps/api/src/me/calendar/calendar.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Append inside the `describe('MeCalendarService', ...)` block:

```ts
  describe('reschedule', () => {
    it('throws ForbiddenException when target event has no ICS ID', async () => {
      gcal.listEventsInRange.mockResolvedValue([
        {
          id: 'e-ext',
          summary: 'Standup',
          description: 'no marker here',
          start: new Date('2026-04-20T13:00:00Z'),
          end: new Date('2026-04-20T13:15:00Z'),
          allDay: false,
        },
      ]);
      // The implementation must verify the event is ICS. One way: look up
      // the event via gcal.getEvent. We'll add that helper in the impl.
      // The test asserts the error regardless of the lookup mechanism.
      await expect(
        service.reschedule(
          'user-1',
          'e-ext',
          new Date('2026-04-20T14:00:00Z'),
          new Date('2026-04-20T15:00:00Z'),
        ),
      ).rejects.toThrow(/Cannot reschedule non-ICS/);
    });

    it('calls rescheduleEvent when target event has an ICS ID', async () => {
      gcal.listEventsInRange.mockResolvedValue([
        {
          id: 'e-ics',
          summary: 'Two pointers',
          description: 'ICS ID: plan-1/item-1',
          start: new Date('2026-04-20T14:00:00Z'),
          end: new Date('2026-04-20T14:30:00Z'),
          allDay: false,
        },
      ]);
      gcal.rescheduleEvent.mockResolvedValue(undefined);
      await service.reschedule(
        'user-1',
        'e-ics',
        new Date('2026-04-20T16:00:00Z'),
        new Date('2026-04-20T16:30:00Z'),
      );
      expect(gcal.rescheduleEvent).toHaveBeenCalledWith(
        'user-1',
        'e-ics',
        new Date('2026-04-20T16:00:00Z'),
        new Date('2026-04-20T16:30:00Z'),
      );
    });
  });
```

Note: since `GoogleCalendarService` doesn't have a `getEvent(userId, eventId)` helper, we'll look the event up by listing a wide enough range around the new time. For simplicity and to stay DRY, the test mocks `listEventsInRange` to return the candidate — the service implementation will call it with a 48h window covering `[start - 24h, end + 24h]`.

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern calendar.service`
Expected: FAIL — `service.reschedule is not a function`.

- [ ] **Step 3: Add `reschedule` to `MeCalendarService`**

In `apps/api/src/me/calendar/calendar.service.ts`, append inside the class:

```ts
  async reschedule(
    userId: string,
    eventId: string,
    start: Date,
    end: Date,
  ): Promise<void> {
    // Look up the event in a 48h window around the new time to verify it's ICS.
    // Using listEventsInRange keeps us on one auth path; googleapis lacks a
    // cheap "get single event by id" without another service method.
    const windowStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const windowEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    const events = await this.gcal.listEventsInRange(userId, windowStart, windowEnd, {
      includeAllDay: true,
    });
    const target = events.find((e) => e.id === eventId);
    if (!target || !extractIcsId(target.description)) {
      // Throw a ForbiddenException so the controller maps it to 403.
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException('Cannot reschedule non-ICS events');
    }
    await this.gcal.rescheduleEvent(userId, eventId, start, end);
  }
```

Prefer a top-level import over the dynamic `await import`. Refactor to add `ForbiddenException` to the existing `@nestjs/common` import at the top of the file:

```ts
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
```

And simplify the body:

```ts
    if (!target || !extractIcsId(target.description)) {
      throw new ForbiddenException('Cannot reschedule non-ICS events');
    }
    await this.gcal.rescheduleEvent(userId, eventId, start, end);
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern calendar.service`
Expected: all tests PASS (both classification and reschedule).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/me/calendar/calendar.service.ts apps/api/src/me/calendar/calendar.service.spec.ts
git commit -m "feat(api): MeCalendarService.reschedule — ICS-only, 403 for externals"
```

---

### Task 6: Add the controller — `GET /me/calendar` + `PATCH /me/calendar/events/:id`

**Files:**
- Create: `apps/api/src/me/calendar/calendar.controller.ts`
- Modify: `apps/api/src/me/calendar/calendar.module.ts`

- [ ] **Step 1: Create the controller**

Create `apps/api/src/me/calendar/calendar.controller.ts`:

```ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../../auth/strategies/jwt.strategy.js';
import { MeCalendarService } from './calendar.service.js';

@Controller('me/calendar')
export class MeCalendarController {
  constructor(private readonly svc: MeCalendarService) {}

  @Get()
  getWeek(
    @CurrentUser() user: JwtStrategyPayload,
    @Query('weekStart') weekStart?: string,
  ) {
    if (!weekStart) {
      throw new BadRequestException('weekStart query param is required (YYYY-MM-DD)');
    }
    const parsed = new Date(weekStart + 'T00:00:00');
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('weekStart must be a valid YYYY-MM-DD date');
    }
    return this.svc.getWeek(user.sub, parsed);
  }

  @Patch('events/:eventId')
  @HttpCode(204)
  async reschedule(
    @CurrentUser() user: JwtStrategyPayload,
    @Param('eventId') eventId: string,
    @Body() body: { start?: string; end?: string },
  ): Promise<void> {
    if (!body.start || !body.end) {
      throw new BadRequestException('start and end are required ISO datetimes');
    }
    const start = new Date(body.start);
    const end = new Date(body.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('start and end must be valid ISO datetimes');
    }
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('end must be after start');
    }
    await this.svc.reschedule(user.sub, eventId, start, end);
  }
}
```

- [ ] **Step 2: Register the controller in the module**

Edit `apps/api/src/me/calendar/calendar.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MeCalendarService } from './calendar.service.js';
import { MeCalendarController } from './calendar.controller.js';

@Module({
  controllers: [MeCalendarController],
  providers: [MeCalendarService],
  exports: [MeCalendarService],
})
export class MeCalendarModule {}
```

- [ ] **Step 3: Typecheck + existing tests**

Run: `pnpm --filter @ics-select/api typecheck && pnpm --filter @ics-select/api test`
Expected: PASS across all suites. If `GoogleCalendarService` isn't available to the new module at runtime, that will surface now — check that `GoogleCalendarModule` is exported globally or imported by `MeCalendarModule`. Look at where existing consumers like `WeeklyPlansModule` import it and mirror.

- [ ] **Step 4: If the typecheck/test shows `GoogleCalendarService` is not provided, import its module**

In `calendar.module.ts`:

```ts
import { GoogleCalendarModule } from '../../google-calendar/google-calendar.module.js';
// ...
@Module({
  imports: [GoogleCalendarModule],
  controllers: [MeCalendarController],
  providers: [MeCalendarService],
  exports: [MeCalendarService],
})
```

- [ ] **Step 5: Re-run tests**

Run: `pnpm --filter @ics-select/api test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/me/calendar/calendar.controller.ts apps/api/src/me/calendar/calendar.module.ts
git commit -m "feat(api): add /me/calendar controller (GET week, PATCH reschedule)"
```

---

### Task 7: Add web query hooks — `useMeCalendarWeek` + `useRescheduleEvent`

**Files:**
- Create: `apps/web/lib/queries/me-calendar.ts`

- [ ] **Step 1: Create the query file**

Create `apps/web/lib/queries/me-calendar.ts`:

```ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ItemOutcome } from '@ics-select/shared';
import { apiFetch } from '../api/client';

export type CalendarEvent = {
  id: string;
  kind: 'ICS' | 'EXTERNAL';
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  meetLink?: string;
  htmlLink?: string;
  ics?: {
    planId: string;
    itemId: string;
    url: string | null;
    format: string;
    topic: { slug: string; label: string } | null;
    outcome: ItemOutcome;
  };
};

export type GetWeekResponse = {
  weekStart: string;
  weekEnd: string;
  timezone: string;
  hasGoogleConnection: boolean;
  events: CalendarEvent[];
};

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useMeCalendarWeek(weekStart: Date) {
  const key = isoDate(weekStart);
  return useQuery({
    queryKey: ['me', 'calendar', key],
    queryFn: () => apiFetch<GetWeekResponse>(`/me/calendar?weekStart=${key}`),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useRescheduleEvent(weekStart: Date) {
  const qc = useQueryClient();
  const key = ['me', 'calendar', isoDate(weekStart)] as const;
  return useMutation({
    mutationFn: async (input: { eventId: string; start: string; end: string }) => {
      return apiFetch<void>(`/me/calendar/events/${input.eventId}`, {
        method: 'PATCH',
        body: JSON.stringify({ start: input.start, end: input.end }),
      });
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<GetWeekResponse>(key);
      if (previous) {
        qc.setQueryData<GetWeekResponse>(key, {
          ...previous,
          events: previous.events.map((e) =>
            e.id === input.eventId ? { ...e, start: input.start, end: input.end } : e,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/queries/me-calendar.ts
git commit -m "feat(web): add useMeCalendarWeek + useRescheduleEvent hooks"
```

---

### Task 8: Build atomic components — header, sidebar, legend, skeleton, connect banner

These are small presentational components with no data fetching. Create them all in one task because each is <50 LOC.

**Files:**
- Create: `apps/web/components/member/calendar/calendar-header.tsx`
- Create: `apps/web/components/member/calendar/calendar-sidebar.tsx`
- Create: `apps/web/components/member/calendar/calendar-legend.tsx`
- Create: `apps/web/components/member/calendar/calendar-skeleton.tsx`
- Create: `apps/web/components/member/calendar/calendar-connect-banner.tsx`

- [ ] **Step 1: Create `calendar-header.tsx`**

```tsx
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarHeaderProps {
  weekStart: Date;
  weekEnd: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function formatRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
  return `${fmt(start)} – ${fmt(end)}`;
}

export function CalendarHeader({ weekStart, weekEnd, onPrev, onNext, onToday }: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border-token pb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="grid h-8 w-8 place-items-center rounded-input text-fg-soft transition-colors hover:bg-bg-subtle hover:text-fg"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <span className="font-serif text-xl font-medium tabular-nums text-fg">
          {formatRange(weekStart, weekEnd)}
        </span>
        <button
          type="button"
          onClick={onNext}
          className="grid h-8 w-8 place-items-center rounded-input text-fg-soft transition-colors hover:bg-bg-subtle hover:text-fg"
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
      <button
        type="button"
        onClick={onToday}
        className="rounded-input border border-border-token px-3 py-1 font-sans text-sm font-medium text-fg-soft transition-colors hover:bg-bg-subtle hover:text-fg"
      >
        Today
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `calendar-sidebar.tsx`**

```tsx
'use client';

import Link from 'next/link';
import type { CalendarEvent } from '../../../lib/queries/me-calendar';
import { detectPlatform } from '../../../lib/format/platform';
import { Eyebrow } from '../../ui/eyebrow';

interface CalendarSidebarProps {
  events: CalendarEvent[];
  timezone: string;
}

const OUTCOME_CLASS: Record<string, string> = {
  PENDING: 'bg-[var(--pending)]',
  DONE_EASY: 'bg-[var(--done-easy)]',
  DONE_HARD: 'bg-[var(--done-hard)]',
  DOUBTS: 'bg-[var(--doubts)]',
  STUCK: 'bg-[var(--stuck)]',
};

const PLATFORM_CLASS: Record<string, string> = {
  leetcode: 'bg-[var(--platform-leetcode)]',
  youtube: 'bg-[var(--platform-youtube)]',
  medium: 'bg-[var(--platform-medium)]',
  github: 'bg-[var(--platform-github)]',
  article: 'bg-[var(--platform-article)]',
  book: 'bg-[var(--platform-book)]',
};

function formatTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(new Date(iso));
}

function formatDayKey(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  }).format(new Date(iso)).toUpperCase();
}

export function CalendarSidebar({ events, timezone }: CalendarSidebarProps) {
  const ics = events.filter((e) => e.kind === 'ICS');
  if (ics.length === 0) {
    return (
      <aside className="space-y-4">
        <Eyebrow>This week · 0 ICS</Eyebrow>
        <p className="font-sans text-sm text-fg-mute">No study blocks this week.</p>
      </aside>
    );
  }

  // Group by day using the member timezone.
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of ics) {
    const key = formatDayKey(e.start, timezone);
    const arr = byDay.get(key) ?? [];
    arr.push(e);
    byDay.set(key, arr);
  }

  return (
    <aside className="space-y-6">
      <Eyebrow>This week · {ics.length} ICS</Eyebrow>
      {[...byDay.entries()].map(([day, items]) => (
        <div key={day} className="space-y-2">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
            {day}
          </p>
          <ul className="space-y-1">
            {items.map((item) => {
              const platform = detectPlatform(item.ics?.url, item.ics?.format);
              const outcome = item.ics?.outcome ?? 'PENDING';
              return (
                <li key={item.id}>
                  <Link
                    href={`/me/item/${item.ics?.itemId}`}
                    className="group flex items-center gap-2 rounded-input py-1.5 pl-0 pr-2 transition-colors hover:bg-bg-subtle"
                  >
                    <span className={`h-full min-h-[28px] w-[3px] rounded-sm ${PLATFORM_CLASS[platform]}`} />
                    <span className={`h-2 w-2 rounded-full ${OUTCOME_CLASS[outcome]}`} />
                    <span className="flex-1 truncate font-serif text-[13px] text-fg">
                      {item.title}
                    </span>
                    <span className="font-sans text-[10px] tabular-nums text-fg-mute">
                      {formatTime(item.start, timezone)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </aside>
  );
}
```

- [ ] **Step 3: Create `calendar-legend.tsx`**

```tsx
const ITEMS: { label: string; cls: string }[] = [
  { label: 'Not yet', cls: 'bg-[var(--pending)]' },
  { label: 'Nailed it', cls: 'bg-[var(--done-easy)]' },
  { label: 'Got it (hard)', cls: 'bg-[var(--done-hard)]' },
  { label: 'Had doubts', cls: 'bg-[var(--doubts)]' },
  { label: 'Stuck', cls: 'bg-[var(--stuck)]' },
];

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border-token pt-4 font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
      <span className="font-semibold">Outcomes</span>
      {ITEMS.map(({ label, cls }) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `calendar-skeleton.tsx`**

```tsx
export function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-full animate-pulse rounded-input bg-bg-subtle" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-[60vh] animate-pulse rounded-input bg-bg-subtle" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `calendar-connect-banner.tsx`**

```tsx
interface CalendarConnectBannerProps {
  variant: 'not_connected' | 'token_expired';
}

export function CalendarConnectBanner({ variant }: CalendarConnectBannerProps) {
  const copy =
    variant === 'not_connected'
      ? 'Connect your Google Calendar to see your week here.'
      : 'Your Google Calendar session expired. Reconnect to continue.';
  const cta = variant === 'not_connected' ? 'Connect Google Calendar' : 'Reconnect';
  return (
    <div className="flex items-center justify-between gap-4 rounded-card border border-border-token bg-bg-warm px-4 py-3">
      <p className="font-sans text-sm text-fg-soft">{copy}</p>
      <a
        href="/auth/google"
        className="rounded-input bg-fg px-3 py-1.5 font-sans text-sm font-medium text-bg transition-opacity hover:opacity-90"
      >
        {cta}
      </a>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`
Expected: PASS. If `Eyebrow` or tailwind token names aren't what the file expects, check `apps/web/components/ui/eyebrow.tsx` and `apps/web/tailwind.config.ts` for the actual names and adjust imports/class names to match (`text-fg`/`text-ink`, `bg-bg-subtle`/`bg-paper-warm`, etc.).

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/member/calendar/calendar-header.tsx apps/web/components/member/calendar/calendar-sidebar.tsx apps/web/components/member/calendar/calendar-legend.tsx apps/web/components/member/calendar/calendar-skeleton.tsx apps/web/components/member/calendar/calendar-connect-banner.tsx
git commit -m "feat(web): calendar atomic components (header, sidebar, legend, skeleton, banner)"
```

---

### Task 9: Build the event-block renderers + popover

**Files:**
- Create: `apps/web/components/member/calendar/calendar-event-ics.tsx`
- Create: `apps/web/components/member/calendar/calendar-event-external.tsx`
- Create: `apps/web/components/member/calendar/calendar-event-popover.tsx`

- [ ] **Step 1: Create the ICS block renderer**

```tsx
'use client';

import type { CalendarEvent } from '../../../lib/queries/me-calendar';
import { detectPlatform, platformLabel } from '../../../lib/format/platform';

const OUTCOME_CLASS: Record<string, string> = {
  PENDING: 'bg-[var(--pending)]',
  DONE_EASY: 'bg-[var(--done-easy)]',
  DONE_HARD: 'bg-[var(--done-hard)]',
  DOUBTS: 'bg-[var(--doubts)]',
  STUCK: 'bg-[var(--stuck)]',
};

const PLATFORM_CLASS: Record<string, string> = {
  leetcode: 'bg-[var(--platform-leetcode)]',
  youtube: 'bg-[var(--platform-youtube)]',
  medium: 'bg-[var(--platform-medium)]',
  github: 'bg-[var(--platform-github)]',
  article: 'bg-[var(--platform-article)]',
  book: 'bg-[var(--platform-book)]',
};

interface CalendarEventIcsProps {
  event: CalendarEvent;
  timeLabel: string;
}

export function CalendarEventIcs({ event, timeLabel }: CalendarEventIcsProps) {
  const platform = detectPlatform(event.ics?.url, event.ics?.format);
  const outcome = event.ics?.outcome ?? 'PENDING';
  return (
    <div className="relative flex h-full overflow-hidden rounded-input border border-border-token bg-bg cursor-grab">
      <span className={`w-[3px] flex-shrink-0 ${PLATFORM_CLASS[platform]}`} />
      <div className="flex min-w-0 flex-1 flex-col px-2 py-1">
        <span className="truncate font-serif text-[12px] leading-tight text-fg">
          {event.title}
        </span>
        <span className="font-sans text-[10px] tabular-nums text-fg-mute">
          {timeLabel} · {platformLabel(platform)}
        </span>
      </div>
      <span
        className={`absolute right-1 top-1 h-2 w-2 rounded-full ${OUTCOME_CLASS[outcome]}`}
        aria-label={`Outcome: ${outcome}`}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the external block renderer**

```tsx
'use client';

import { MapPin, Video } from 'lucide-react';
import type { CalendarEvent } from '../../../lib/queries/me-calendar';

interface CalendarEventExternalProps {
  event: CalendarEvent;
  timeLabel: string;
}

export function CalendarEventExternal({ event, timeLabel }: CalendarEventExternalProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-input bg-bg-warm px-2 py-1">
      <span className="truncate font-sans text-[11px] font-medium text-fg-soft">
        {event.title}
      </span>
      <div className="flex items-center gap-2 font-sans text-[10px] tabular-nums text-fg-mute">
        <span>{timeLabel}</span>
        {event.location && (
          <span className="inline-flex items-center gap-0.5">
            <MapPin className="h-2.5 w-2.5" strokeWidth={1.5} />
            <span className="max-w-[80px] truncate">{event.location}</span>
          </span>
        )}
        {event.meetLink && <Video className="h-2.5 w-2.5" strokeWidth={1.5} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the popover**

```tsx
'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@heroui/react';
import { ExternalLink, MapPin, Video } from 'lucide-react';
import type { CalendarEvent } from '../../../lib/queries/me-calendar';

interface CalendarEventPopoverProps {
  event: CalendarEvent;
  timeLabel: string;
  children: React.ReactNode;
}

export function CalendarEventPopover({ event, timeLabel, children }: CalendarEventPopoverProps) {
  return (
    <Popover placement="right">
      <PopoverTrigger>
        <div className="h-full w-full">{children}</div>
      </PopoverTrigger>
      <PopoverContent className="max-w-[280px] rounded-card border border-border-token bg-bg p-4">
        <div className="space-y-2">
          <p className="font-serif text-base font-medium text-fg">{event.title}</p>
          <p className="font-sans text-sm text-fg-soft">{timeLabel}</p>
          {event.location && (
            <p className="flex items-center gap-1.5 font-sans text-sm text-fg-soft">
              <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
              {event.location}
            </p>
          )}
          {event.meetLink && (
            <a
              href={event.meetLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-sans text-sm text-fg underline underline-offset-2"
            >
              <Video className="h-3.5 w-3.5" strokeWidth={1.5} />
              Join Meet
            </a>
          )}
          {event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-sans text-sm text-fg-soft underline underline-offset-2"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
              Open in Google Calendar
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/member/calendar/calendar-event-ics.tsx apps/web/components/member/calendar/calendar-event-external.tsx apps/web/components/member/calendar/calendar-event-popover.tsx
git commit -m "feat(web): ICS/external event renderers + external popover"
```

---

### Task 10: Build the `CalendarGrid` FullCalendar wrapper

**Files:**
- Create: `apps/web/components/member/calendar/calendar-grid.tsx`

- [ ] **Step 1: Create the grid component**

```tsx
'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import type { CalendarEvent } from '../../../lib/queries/me-calendar';
import { CalendarEventIcs } from './calendar-event-ics';
import { CalendarEventExternal } from './calendar-event-external';
import { CalendarEventPopover } from './calendar-event-popover';

interface CalendarGridProps {
  weekStart: Date;
  weekEnd: Date;
  timezone: string;
  events: CalendarEvent[];
  onReschedule: (input: { eventId: string; start: string; end: string }) => void;
}

function computeSlotBounds(events: CalendarEvent[]): { min: string; max: string } {
  if (events.length === 0) return { min: '06:00:00', max: '23:00:00' };
  let minHour = 6;
  let maxHour = 23;
  for (const e of events) {
    if (e.allDay) continue;
    const s = new Date(e.start);
    const eEnd = new Date(e.end);
    minHour = Math.min(minHour, Math.max(0, s.getHours()));
    maxHour = Math.max(maxHour, Math.min(23, eEnd.getHours() + 1));
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return { min: `${pad(minHour)}:00:00`, max: `${pad(maxHour)}:00:00` };
}

function formatTimeRange(start: string, end: string, timezone: string): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(new Date(iso));
  return `${fmt(start)}–${fmt(end)}`;
}

export function CalendarGrid({
  weekStart,
  weekEnd,
  timezone,
  events,
  onReschedule,
}: CalendarGridProps) {
  const router = useRouter();

  const fcEvents = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        editable: e.kind === 'ICS',
        extendedProps: { kind: e.kind, data: e } satisfies {
          kind: 'ICS' | 'EXTERNAL';
          data: CalendarEvent;
        },
      })),
    [events],
  );

  const slotBounds = useMemo(() => computeSlotBounds(events), [events]);

  const handleDrop = (arg: EventDropArg | EventResizeDoneArg) => {
    if (arg.event.extendedProps.kind !== 'ICS') {
      arg.revert();
      return;
    }
    const start = arg.event.start?.toISOString();
    const end = arg.event.end?.toISOString();
    if (!start || !end) {
      arg.revert();
      return;
    }
    onReschedule({ eventId: arg.event.id, start, end });
  };

  const handleClick = (arg: EventClickArg) => {
    const data = arg.event.extendedProps.data as CalendarEvent;
    if (data.kind === 'ICS' && data.ics?.itemId) {
      router.push(`/me/item/${data.ics.itemId}`);
    }
  };

  return (
    <div className="ics-calendar-grid">
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        initialDate={weekStart}
        headerToolbar={false}
        allDaySlot
        firstDay={0}
        locale="en"
        nowIndicator
        timeZone={timezone}
        slotMinTime={slotBounds.min}
        slotMaxTime={slotBounds.max}
        expandRows
        height="70vh"
        editable
        eventConstraint={{
          start: weekStart.toISOString(),
          end: weekEnd.toISOString(),
        }}
        events={fcEvents}
        eventClick={handleClick}
        eventDrop={handleDrop}
        eventResize={handleDrop}
        eventContent={(arg) => {
          const data = arg.event.extendedProps.data as CalendarEvent;
          const timeLabel = formatTimeRange(data.start, data.end, timezone);
          if (data.kind === 'ICS') {
            return <CalendarEventIcs event={data} timeLabel={timeLabel} />;
          }
          return (
            <CalendarEventPopover event={data} timeLabel={timeLabel}>
              <CalendarEventExternal event={data} timeLabel={timeLabel} />
            </CalendarEventPopover>
          );
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`
Expected: PASS. If FullCalendar's types complain about `eventContent` returning a React node directly, wrap the return in a `{ html: ... }` / `{ domNodes: [...] }` shape per the lib's docs; the `@fullcalendar/react` package supports returning JSX directly but check the installed version's types.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/calendar/calendar-grid.tsx
git commit -m "feat(web): CalendarGrid — FullCalendar wrapper with ICS drag + external popover"
```

---

### Task 11: Compose the `/me/calendar` page

**Files:**
- Create: `apps/web/app/(member)/me/calendar/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMeCalendarWeek, useRescheduleEvent, isoDate } from '../../../../lib/queries/me-calendar';
import { CalendarHeader } from '../../../../components/member/calendar/calendar-header';
import { CalendarSidebar } from '../../../../components/member/calendar/calendar-sidebar';
import { CalendarLegend } from '../../../../components/member/calendar/calendar-legend';
import { CalendarSkeleton } from '../../../../components/member/calendar/calendar-skeleton';
import { CalendarConnectBanner } from '../../../../components/member/calendar/calendar-connect-banner';
import { CalendarGrid } from '../../../../components/member/calendar/calendar-grid';

function startOfSundayWeek(d: Date): Date {
  const copy = new Date(d);
  const dayIdx = copy.getDay(); // 0 = Sunday
  copy.setDate(copy.getDate() - dayIdx);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function MeCalendarPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfSundayWeek(new Date()));
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const { data, isLoading } = useMeCalendarWeek(weekStart);
  const reschedule = useRescheduleEvent(weekStart);

  const handlePrev = useCallback(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }, [weekStart]);
  const handleNext = useCallback(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }, [weekStart]);
  const handleToday = useCallback(() => setWeekStart(startOfSundayWeek(new Date())), []);

  return (
    <div className="space-y-4">
      <CalendarHeader
        weekStart={weekStart}
        weekEnd={weekEnd}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
      />
      {isLoading || !data ? (
        <CalendarSkeleton />
      ) : (
        <>
          {!data.hasGoogleConnection && <CalendarConnectBanner variant="not_connected" />}
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <CalendarSidebar events={data.events} timezone={data.timezone} />
            <div className="space-y-4">
              <CalendarGrid
                weekStart={weekStart}
                weekEnd={weekEnd}
                timezone={data.timezone}
                events={data.events}
                onReschedule={(input) => reschedule.mutate(input)}
              />
              <CalendarLegend />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(member\)/me/calendar/page.tsx
git commit -m "feat(web): /me/calendar page composing grid + sidebar + legend"
```

---

### Task 12: FullCalendar CSS overrides to match design system

FullCalendar ships its own CSS via the installed packages. We need to import it and override `--fc-*` variables to match paper/ink/rule tokens.

**Files:**
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Add FullCalendar imports + variable overrides**

Append to `apps/web/app/globals.css` (at the end of the file):

```css
/* FullCalendar — Magazine Editorial adaption */
.ics-calendar-grid {
  --fc-border-color: var(--rule);
  --fc-page-bg-color: var(--surface);
  --fc-neutral-bg-color: var(--paper-warm);
  --fc-today-bg-color: rgba(79, 70, 229, 0.04); /* --focus faded */
  --fc-now-indicator-color: var(--focus);
  --fc-event-border-color: transparent;
  --fc-event-bg-color: transparent;
  --fc-event-text-color: var(--ink);
  font-family: var(--font-sans);
}

.ics-calendar-grid .fc-col-header-cell-cushion,
.ics-calendar-grid .fc-timegrid-axis-cushion,
.ics-calendar-grid .fc-timegrid-slot-label-cushion {
  font-family: var(--font-sans);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--ink-mute);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ics-calendar-grid .fc-event {
  border: none;
  background: transparent;
  box-shadow: none;
}

.ics-calendar-grid .fc-timegrid-event .fc-event-main {
  padding: 0;
}

.ics-calendar-grid .fc-scrollgrid,
.ics-calendar-grid .fc-scrollgrid td,
.ics-calendar-grid .fc-scrollgrid th {
  border-color: var(--rule);
}
```

Note: the token names (`--rule`, `--ink`, `--paper-warm`, `--surface`, `--focus`) come from `docs/design-system.md`. If they're mapped to different CSS variable names in the current globals.css, read that file first and use the correct names.

- [ ] **Step 2: Import FullCalendar base styles**

FullCalendar v6 ships CSS with each plugin. Add these imports at the top of `apps/web/app/globals.css`, after any other `@import` lines:

```css
@import '@fullcalendar/core/main.css';
@import '@fullcalendar/timegrid/main.css';
```

If Next.js complains about CSS imports from node_modules in `globals.css`, move them to the top of `apps/web/app/layout.tsx` instead:

```ts
import '@fullcalendar/core/main.css';
import '@fullcalendar/timegrid/main.css';
```

- [ ] **Step 3: Typecheck + build web**

Run: `pnpm --filter @ics-select/web typecheck && pnpm --filter @ics-select/web build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/globals.css apps/web/app/layout.tsx
git commit -m "style(web): FullCalendar Magazine Editorial CSS overrides"
```

---

### Task 13: Update topbar + bottom tab bar, redirect `/me/plan`

**Files:**
- Modify: `apps/web/components/member-shell/topbar-member.tsx`
- Modify: `apps/web/components/member-shell/bottom-tab-bar.tsx`
- Modify: `apps/web/app/(member)/me/plan/page.tsx`

- [ ] **Step 1: Update topbar**

In `apps/web/components/member-shell/topbar-member.tsx`, change:

```ts
{ href: '/me/plan', label: 'Week', icon: CalendarDays },
```

to:

```ts
{ href: '/me/calendar', label: 'Calendar', icon: CalendarDays },
```

- [ ] **Step 2: Update bottom tab bar**

Read `apps/web/components/member-shell/bottom-tab-bar.tsx`, find the entry pointing to `/me/plan` with label `Week`, and replace it the same way. If the file uses a different shape (e.g., no label), just update the href to `/me/calendar`.

- [ ] **Step 3: Convert `/me/plan` to a redirect**

Replace the contents of `apps/web/app/(member)/me/plan/page.tsx` with:

```tsx
import { redirect } from 'next/navigation';

export default function MePlanPage() {
  redirect('/me/calendar');
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/member-shell/topbar-member.tsx apps/web/components/member-shell/bottom-tab-bar.tsx apps/web/app/\(member\)/me/plan/page.tsx
git commit -m "feat(web): rename Week nav to Calendar + redirect /me/plan"
```

---

### Task 14: Delete unused `WeekList` component

**Files:**
- Delete: `apps/web/components/member/week-list.tsx`

- [ ] **Step 1: Confirm `/me/plan` is the only consumer**

Run: `grep -r "WeekList\|week-list" apps/web --include="*.tsx" --include="*.ts"`
Expected: only matches inside `week-list.tsx` itself (now unused since `/me/plan/page.tsx` was rewritten as a redirect in Task 13).

If there are any other matches, abort and investigate before deleting.

- [ ] **Step 2: Delete**

```bash
rm apps/web/components/member/week-list.tsx
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -u apps/web/components/member/week-list.tsx
git commit -m "chore(web): remove unused WeekList (replaced by /me/calendar)"
```

---

### Task 15: Manual verification — end-to-end

The API has Jest coverage but the UI has no Playwright today (the repo's test commands reference it, but there's no `playwright.config` or existing `*.spec.ts`). Verify by hand via the dev server.

- [ ] **Step 1: Rebuild shared + start API + web**

```bash
pnpm --filter @ics-select/shared build
pnpm dev
```

(Or run `pnpm --filter @ics-select/api dev` and `pnpm --filter @ics-select/web dev` in two terminals.)

- [ ] **Step 2: Seed a test user with a published plan + GCal tokens**

If you don't already have a logged-in member with a published plan, follow `apps/api/.env.example` guidance to configure Google OAuth, log in via `/login`, publish a plan as admin to that member. Confirm via Google Calendar web that the study blocks appear.

- [ ] **Step 3: Smoke the UI**

Open `http://localhost:3000/me/calendar`. Verify:

- Header shows the current Sunday–Saturday range.
- Left sidebar lists ICS events grouped by day with outcome dot + platform stripe.
- Grid renders ICS blocks with platform-colored left stripe, outcome dot top-right.
- Grid renders external Google events in paper-warm neutral style.
- Clicking an external block opens a popover with title, time, and "Open in Google Calendar" link (if present).
- Clicking an ICS block navigates to `/me/item/<id>`.
- Legend bar appears below the grid.

- [ ] **Step 4: Smoke drag-to-reschedule**

Drag an ICS block to a new time within the same week. Verify:

- The block moves immediately (optimistic UI).
- Google Calendar (open in another tab, refresh) shows the updated start/end.
- Reloading `/me/calendar` keeps the new position.
- Attempting to drag outside the visible week snaps back (constraint).

- [ ] **Step 5: Smoke external immutability**

Attempt to drag a non-ICS event. It should not move (editable=false).

- [ ] **Step 6: Smoke disconnected state**

Temporarily revoke the dev user's Google permissions (in Google Account settings → Security → third-party apps → remove access for this OAuth client). Reload `/me/calendar`. Verify the "Connect Google Calendar" banner appears.

- [ ] **Step 7: Smoke mobile**

Resize viewport to 390px. Verify header, grid, sidebar, and legend stack vertically and nothing overflows horizontally (the grid itself may scroll horizontally — that's expected per the spec).

- [ ] **Step 8: Smoke prev/next/today arrows**

Click `←` and `→` to move across weeks. Verify the header range updates, events refetch, and `Today` snaps back.

- [ ] **Step 9: If any smoke fails, file or fix**

If a specific issue is a quick fix, fix it and add a follow-up commit to the same task list. If it needs deeper investigation, stop and flag.

- [ ] **Step 10: Final typecheck + API tests one more time**

```bash
pnpm --filter @ics-select/api typecheck
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/web typecheck
```

Expected: all PASS.

- [ ] **Step 11: Optional — run `pnpm --filter @ics-select/web build`** to catch any SSR/client-boundary issue FullCalendar might trigger. If it fails because FullCalendar hits `window` during SSR, wrap `CalendarGrid` in `next/dynamic` with `ssr: false`:

```tsx
// in apps/web/app/(member)/me/calendar/page.tsx, at top
import dynamic from 'next/dynamic';
const CalendarGrid = dynamic(
  () => import('../../../../components/member/calendar/calendar-grid').then((m) => m.CalendarGrid),
  { ssr: false },
);
```

Then commit this adjustment.

---

## Self-Review

**Spec coverage:** every goal in the spec is addressed — routing change (Task 13), backend endpoints (Tasks 4–6), `includeAllDay` + enriched fields (Task 2), `rescheduleEvent` (Task 3), query hooks (Task 7), presentational components (Tasks 8–9), FullCalendar wrapper with drag (Task 10), page composition (Task 11), CSS overrides (Task 12), cleanup (Task 14), manual verification (Task 15). Non-goals explicitly excluded. Future hooks noted but not implemented.

**Type consistency:** `CalendarEvent` shape defined once in API (Task 4) and mirrored in web query file (Task 7) with matching fields. `ICS ID:` extraction uses the existing `extractIcsId`. Outcome tokens map consistently across sidebar (Task 8), ICS block (Task 9), and legend (Task 8).

**Placeholders:** none — every step has complete code or an exact command with expected output.

**Known risks:** FullCalendar SSR (addressed in Task 15 step 11), Tailwind token name drift (addressed inline in Task 8 step 6), GoogleCalendarModule wiring (addressed in Task 6 step 4).
