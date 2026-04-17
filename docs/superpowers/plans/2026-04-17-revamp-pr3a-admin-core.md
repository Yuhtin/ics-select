# PR 3a — Admin Core: Triage + Cycle + Scheduler Fix (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the admin daily loop. The admin opens the app, sees the Triage home (`/admin`) with prioritized alerts, drills into the Cycle page (`/admin/cycle/[id]`) to see the cohort grid + heatmap, and when they publish a plan the scheduler actually respects the member's Google Calendar. Also rewires the reminders cron (disabled since PR 1) to read Google Calendar events by their embedded `ICS ID:` marker.

**Architecture:**

- **Admin shell**: left sidebar (fixed 240px) + main content. Uses `Source Serif 4` family for dense-data surfaces (triage lists, heatmap, member grid). Unlike the member side, admin stays fully editorial — the admin is reading/reflecting.
- **Triage** (`/admin`): alerts computed on-the-fly from existing data. No new `Alert` table — the view is a derivation of `WeeklyPlanItem` + `WeeklyRetro` + `Cycle`. Alert types: `STUCK_RECENT`, `DISAPPEARED`, `STUCK_REPEATEDLY`, `FINISHED_EARLY`, `SKIPPED_RETROS`, `PLAN_PENDING`, `CALENDAR_BROKEN` (already in `AlertType` enum from PR 1). Dismissal stored in `DismissedAlert` (already exists) for 24h snooze.
- **Cycle page** (`/admin/cycle/[id]`): cycle header with inline ranking toggle + members grid (4-col on desktop, 2-col mobile) + GitHub-style heatmap (members × last 6 weeks, colored by weekly completion). Classes management is **deferred to PR 3c** (the cycle page shows them but editing is read-only here).
- **Scheduler fix**: `publication.service.ts` currently passes `busyByDay = {}` (PR 1 disabled the integration). This PR wires `GoogleCalendarService.getFreeBusy` to actually pull the member's busy blocks for the plan's week, groups by day, and hands them to the scheduler. Overflow detection now respects real conflicts.
- **ICS ID embedding**: every Google Calendar event created by the publication flow gets `ICS ID: <planId>/<itemId>` in the `description`. This enables the reminders cron (next bullet) and future "delete all events for this plan" admin operations.
- **Reminders cron rewrite**: the current cron is disabled (PR 1 Task 10 commented out the `@Cron` decorator). Rewrite it to iterate members with `whatsappPhone`, read each member's Google Calendar for events in the next 9-11 minutes, filter by `ICS ID:` in description, send a WhatsApp reminder via Evolution API. Errors are swallowed per-member (one bad OAuth doesn't block others).

**Tech stack:** NestJS 10 + Prisma 5 · Next.js 15 App Router + TanStack Query · Admin design language from `docs/design-system.md` (Source Serif 4 on dense surfaces, Inter chrome) · `googleapis` for Calendar API (already in deps) · Evolution API wrapper at `apps/api/src/whatsapp/`.

**Reference spec:** `docs/superpowers/specs/2026-04-16-revamp-design.md` §5.1 (Triage), §5.2 (Cycle), §8 (API changes), §7 (domain).

**Out of scope (deferred):**
- **PR 3b**: plan editor 3-panel (`/admin/member/[id]/plan/[planId]`).
- **PR 3c**: library + topics + cycles list + ai-usage + member detail page + classes management UI.
- Retro cron (opens Fri 18h notification) — part of PR 4.
- WhatsApp purge cron — part of PR 4.
- Admin chat / AI enhancements — part of PR 4.

---

## File Structure

### Created (Backend)

- `apps/api/src/admin/admin.module.ts`
- `apps/api/src/admin/triage/triage.service.ts`
- `apps/api/src/admin/triage/triage.service.spec.ts`
- `apps/api/src/admin/triage/triage.controller.ts`
- `apps/api/src/admin/triage/triage.module.ts`
- `apps/api/src/admin/alerts/alerts.service.ts`
- `apps/api/src/admin/alerts/alerts.service.spec.ts`
- `apps/api/src/admin/alerts/alerts.controller.ts`
- `apps/api/src/admin/alerts/alerts.module.ts`
- `apps/api/src/admin/alerts/dto.ts`
- `apps/api/src/admin/cycle/cycle-overview.service.ts`
- `apps/api/src/admin/cycle/cycle-overview.service.spec.ts`
- `apps/api/src/admin/cycle/cycle-overview.controller.ts`
- `apps/api/src/admin/cycle/cycle-overview.module.ts`
- `apps/api/src/admin/cycle/dto.ts` (ranking toggle DTO)
- `apps/api/src/common/ics-id/ics-id.ts` (parse/embed helpers)
- `apps/api/src/common/ics-id/ics-id.spec.ts`

### Modified (Backend)

- `apps/api/src/app.module.ts` (import AdminModule)
- `apps/api/src/weekly-plans/publication.service.ts` (wire free/busy + ICS ID embedding)
- `apps/api/src/weekly-plans/publication.service.spec.ts`
- `apps/api/src/google-calendar/google-calendar.service.ts` (ensure event.description embeds ICS ID; add `listEventsWithIcsId` helper for cron)
- `apps/api/src/google-calendar/google-calendar.service.spec.ts`
- `apps/api/src/notifications/reminders.cron.ts` (rewrite body to use Calendar + ICS ID)
- `apps/api/src/notifications/reminders.cron.spec.ts` (if exists; create if missing)
- `apps/api/src/cycles/cycles.controller.ts` (extend PATCH for rankingVisibleToMembers)
- `apps/api/src/cycles/cycles.service.ts`
- `apps/api/src/cycles/cycles.service.spec.ts`
- `apps/api/src/cycles/dto.ts`

### Created (Frontend)

- `apps/web/components/admin-shell/admin-shell.tsx`
- `apps/web/components/admin-shell/sidebar-admin.tsx`
- `apps/web/components/admin/triage-alert-row.tsx`
- `apps/web/components/admin/cohort-strip.tsx`
- `apps/web/components/admin/cycle-members-grid.tsx`
- `apps/web/components/admin/cohort-heatmap.tsx`
- `apps/web/components/admin/ranking-toggle.tsx`
- `apps/web/lib/queries/admin-triage.ts`
- `apps/web/lib/queries/admin-cycle.ts`
- `apps/web/app/(admin)/admin/page.tsx`
- `apps/web/app/(admin)/admin/cycle/[id]/page.tsx`
- `apps/web/app/(admin)/layout.tsx`

### Deleted (Frontend)

- `apps/web/app/(app)/admin/` (entire subtree — admin routes are being rebuilt from scratch in `(admin)`)
- `apps/web/app/(app)/layout.tsx` (no longer needed — the `(app)` group is retired)
- `apps/web/components/admin/**` (EXCEPT any files referenced by new components — audit first; components like `navbar-admin.tsx` and `bottom-tab-bar-admin.tsx` can go, but shared helpers may stay)

**CAVEAT:** some admin pages (library, members, dashboard, plans, cycles) currently live under `(app)/admin/*`. Deleting `(app)` outright breaks them. This PR 3a **replaces the Triage + Cycle pages** and leaves the other admin pages at their old locations temporarily (they'll be rebuilt in PR 3b/3c). Two options:

- **Option A**: move the old pages to `(app-legacy)/admin/*` and keep them functional until PR 3b/3c rebuild them.
- **Option B**: let the old `(app)/admin/*` subtree remain untouched; rewrite only the parts we need in `(admin)/admin/*`.

**Pick B for this PR**. The legacy admin pages continue to work under `(app)/layout.tsx` + `(app)/admin/*`. The new shell at `(admin)/layout.tsx` owns only `/admin` (triage home) and `/admin/cycle/[id]`. Conflict: Next.js route groups can't have overlapping route paths. Since both `(app)/admin/page.tsx` (old) and `(admin)/admin/page.tsx` (new) would resolve to `/admin`, we need to delete the old `(app)/admin/dashboard/page.tsx` OR rename its route.

**Resolution:** for each file under `(app)/admin/` that resolves to a path the new `(admin)` shell also owns, either (a) delete it (if the new admin/page.tsx replaces it) or (b) leave the old path alone. Collisions by current path:

| Path | New (admin) | Old (app)/admin |
|---|---|---|
| `/admin` | Triage (NEW) | `/admin/cycles` via redirect? Check. |
| `/admin/cycle/[id]` | Cycle page (NEW) | `/admin/cycles/[id]` (slightly different path) |
| `/admin/cycles` | — (PR 3c) | stays for now |
| `/admin/cycles/[id]/classes` | — | stays |
| `/admin/library` | — (PR 3c) | stays |
| `/admin/members*` | — | stays |
| `/admin/plans/*` | — (PR 3b) | stays |
| `/admin/dashboard` | — | stays |

Only direct collision: `/admin` itself. If the `(app)/admin/page.tsx` exists currently, delete it as part of this PR. Keep everything else.

```bash
ls apps/web/app/\(app\)/admin 2>/dev/null
# If `page.tsx` is a direct child: delete it. Otherwise no-op.
```

---

## Tasks

### Task 1: Write `ics-id` helpers + tests

**Files:**
- Create: `apps/api/src/common/ics-id/ics-id.ts`
- Create: `apps/api/src/common/ics-id/ics-id.spec.ts`

**Goal:** Centralize ICS ID string format + parsing. Avoids typos in 3+ callers (publication, cron, future admin delete).

- [ ] **Step 1: Write the spec (TDD)**

Create `apps/api/src/common/ics-id/ics-id.spec.ts`:

```typescript
import { embedIcsId, extractIcsId, ICS_ID_PREFIX } from './ics-id';

describe('ics-id', () => {
  it('embedIcsId wraps with prefix + identifies plan/item pair', () => {
    const out = embedIcsId('Leetcode · binary search', { planId: 'p-1', itemId: 'i-42' });
    expect(out).toContain('Leetcode · binary search');
    expect(out).toContain(`${ICS_ID_PREFIX}p-1/i-42`);
  });

  it('extractIcsId parses embedded description', () => {
    const description = `Some text\nICS ID: plan-abc/item-xyz\nMore text`;
    expect(extractIcsId(description)).toEqual({ planId: 'plan-abc', itemId: 'item-xyz' });
  });

  it('extractIcsId returns null on missing marker', () => {
    expect(extractIcsId('no marker here')).toBeNull();
  });

  it('extractIcsId returns null when format is malformed (missing slash)', () => {
    expect(extractIcsId('ICS ID: just-one-id')).toBeNull();
  });

  it('round-trips embed → extract', () => {
    const body = 'Reminder body\nExisting content';
    const embedded = embedIcsId(body, { planId: 'p-9', itemId: 'i-3' });
    expect(extractIcsId(embedded)).toEqual({ planId: 'p-9', itemId: 'i-3' });
  });
});
```

Run: fails.

- [ ] **Step 2: Implement**

Write `apps/api/src/common/ics-id/ics-id.ts`:

```typescript
export const ICS_ID_PREFIX = 'ICS ID: ';

const PATTERN = /ICS ID:\s*([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/;

export function embedIcsId(
  originalBody: string,
  ids: { planId: string; itemId: string },
): string {
  const tail = `\n\n${ICS_ID_PREFIX}${ids.planId}/${ids.itemId}`;
  return `${originalBody.trimEnd()}${tail}`;
}

export function extractIcsId(
  description: string | null | undefined,
): { planId: string; itemId: string } | null {
  if (!description) return null;
  const match = description.match(PATTERN);
  if (!match) return null;
  return { planId: match[1], itemId: match[2] };
}
```

Run the spec:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern ics-id.spec
```

Expected: 5/5 pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/common/ics-id
git commit -m "feat(api): ics-id helpers (embed + extract) with tests"
```

---

### Task 2: Wire Google Calendar free/busy into publication

**Files:**
- Modify: `apps/api/src/weekly-plans/publication.service.ts`
- Modify: `apps/api/src/weekly-plans/publication.service.spec.ts`
- Modify: `apps/api/src/google-calendar/google-calendar.service.ts` (add `getFreeBusy` if missing)

**Goal:** `publication.service.autoSchedule` currently computes `busyByDay = {}` and passes it to the scheduler. Replace with real free/busy blocks from the member's Google Calendar for the week.

- [ ] **Step 1: Inspect current state**

```bash
grep -n "busyByDay\|getFreeBusy" apps/api/src/weekly-plans/publication.service.ts apps/api/src/google-calendar/google-calendar.service.ts
```

Expected: `busyByDay` is hardcoded `{}` in publication; `getFreeBusy` may exist on GoogleCalendarService (check).

- [ ] **Step 2: Ensure `getFreeBusy(userId, timeMin, timeMax)` exists**

If present, make sure it returns something like `Array<{ start: Date; end: Date }>` per the member's primary calendar. If missing, implement (using `googleapis`):

```typescript
// google-calendar.service.ts — if getFreeBusy isn't there yet
async getFreeBusy(userId: string, timeMin: Date, timeMax: Date): Promise<Array<{ start: Date; end: Date }>> {
  const client = await this.clientFor(userId);
  const calendar = google.calendar({ version: 'v3', auth: client });
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: 'primary' }],
    },
  });
  const busy = response.data.calendars?.primary?.busy ?? [];
  return busy.map((b) => ({ start: new Date(b.start!), end: new Date(b.end!) }));
}
```

Add a spec to cover it (mock the google client).

- [ ] **Step 3: Update `publication.service.ts`**

Replace `busyByDay = {}` with a call to `getFreeBusy(userId, weekStart, weekEnd)` and group the returned blocks by the day of the week (0-6 or date string).

Shape expected by `SchedulerService`:

```typescript
type BusyByDay = Record<string, Array<{ start: Date; end: Date }>>; // key = ISO date YYYY-MM-DD
```

Inline logic:

```typescript
const busyBlocks = await this.calendar.getFreeBusy(plan.userId, plan.weekStart, plan.weekEnd)
  .catch(() => []);  // if Google fails, treat as no conflicts; plan still publishes

const busyByDay: Record<string, Array<{ start: Date; end: Date }>> = {};
for (const block of busyBlocks) {
  const key = block.start.toISOString().slice(0, 10);
  const arr = busyByDay[key] ?? [];
  arr.push(block);
  busyByDay[key] = arr;
}
```

If the scheduler expects a different key format, adapt. Read `apps/api/src/scheduler/scheduler.service.ts` to confirm.

- [ ] **Step 4: Update the spec**

Add tests that mock `calendar.getFreeBusy` returning `[{start, end}]` and assert `scheduler.plan` receives that input in `busyByDay`. Also cover the "Google fails → empty busy" case.

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm --filter @ics-select/api test -- --testPathPattern publication.service.spec
pnpm --filter @ics-select/api typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/weekly-plans/publication.service.ts apps/api/src/weekly-plans/publication.service.spec.ts apps/api/src/google-calendar
git commit -m "fix(scheduler): wire Google Calendar free/busy into publication flow"
```

---

### Task 3: Embed ICS ID in Calendar event descriptions

**Files:**
- Modify: `apps/api/src/google-calendar/google-calendar.service.ts`
- Modify: `apps/api/src/weekly-plans/publication.service.ts`

**Goal:** Every event created by publication contains `ICS ID: <planId>/<itemId>` in the description. Used by the cron (Task 6) and future admin operations.

- [ ] **Step 1: Update `createEvent` to accept `icsId`**

Find `createEvent` in `google-calendar.service.ts`. Add an optional `icsId: { planId: string; itemId: string }` parameter. Inside the method, use `embedIcsId(originalDescription, icsId)` from Task 1 if present.

```typescript
import { embedIcsId } from '../common/ics-id/ics-id';

async createEvent(userId: string, event: {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  icsId?: { planId: string; itemId: string };
}) {
  const description = event.icsId
    ? embedIcsId(event.description ?? '', event.icsId)
    : event.description;
  // ... existing Google API call with the patched description
}
```

- [ ] **Step 2: Update publication.service.ts to pass icsId**

Where publication creates the event per session, pass `icsId: { planId: plan.id, itemId: item.id }`.

- [ ] **Step 3: Update tests**

Update the publication spec to assert that each `calendar.createEvent` mock call receives the `icsId` parameter.

Update the google-calendar spec to assert that when `icsId` is present, the event description contains `ICS ID: plan-x/item-y`.

- [ ] **Step 4: Test + typecheck**

```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/api typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/google-calendar apps/api/src/weekly-plans
git commit -m "feat(google-calendar): embed ICS ID marker in event descriptions on publish"
```

---

### Task 4: Rewrite reminders cron to read Calendar + ICS ID

**Files:**
- Modify: `apps/api/src/notifications/reminders.cron.ts`
- Modify (or create): `apps/api/src/notifications/reminders.cron.spec.ts`
- Modify: `apps/api/src/google-calendar/google-calendar.service.ts` (add `listEventsInRange` if missing)

**Goal:** Bring the reminder cron back from the dead. Every minute, iterate members with `whatsappPhone`, list Calendar events in the next 9-11 minutes, filter by `ICS ID:` in description, send WhatsApp via Evolution API.

- [ ] **Step 1: Add `listEventsInRange(userId, timeMin, timeMax)` to GoogleCalendarService**

If missing, implement:

```typescript
async listEventsInRange(
  userId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<Array<{ id: string; summary: string; description: string; start: Date; end: Date }>> {
  const client = await this.clientFor(userId);
  const calendar = google.calendar({ version: 'v3', auth: client });
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });
  const events = response.data.items ?? [];
  return events.map((e) => ({
    id: e.id!,
    summary: e.summary ?? '',
    description: e.description ?? '',
    start: new Date(e.start?.dateTime ?? e.start?.date ?? ''),
    end: new Date(e.end?.dateTime ?? e.end?.date ?? ''),
  }));
}
```

- [ ] **Step 2: Rewrite `reminders.cron.ts`**

Replace the current no-op body with the real implementation. Keep `@Cron(CronExpression.EVERY_MINUTE)` commented out during development and uncomment before merging:

```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { extractIcsId } from '../common/ics-id/ics-id';

@Injectable()
export class RemindersCron {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: GoogleCalendarService,
    private readonly whatsapp: WhatsappService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendReminders(now: Date = new Date()): Promise<void> {
    const timeMin = new Date(now.getTime() + 9 * 60_000);
    const timeMax = new Date(now.getTime() + 11 * 60_000);

    const members = await this.prisma.user.findMany({
      where: { role: 'MEMBER', whatsappPhone: { not: null } },
      select: { id: true, name: true, whatsappPhone: true },
    });

    for (const member of members) {
      try {
        const events = await this.calendar.listEventsInRange(member.id, timeMin, timeMax);
        for (const event of events) {
          const ids = extractIcsId(event.description);
          if (!ids) continue;
          const minutesAway = Math.round((event.start.getTime() - now.getTime()) / 60_000);
          const text = `${event.summary} começa em ${minutesAway} min. bom estudo ${member.name?.split(' ')[0] ?? ''}.`;
          await this.whatsapp.send(member.id, member.whatsappPhone!, text).catch(() => undefined);
        }
      } catch {
        // Swallow per-member errors so one bad OAuth doesn't block others
      }
    }
  }
}
```

- [ ] **Step 3: Write tests**

Write `apps/api/src/notifications/reminders.cron.spec.ts` covering:
- Iterates only members with `whatsappPhone` set.
- For each event within 9-11 min with a valid ICS ID, calls `whatsapp.send`.
- Ignores events without an ICS ID.
- Continues after one member's Calendar call throws.

Mock `PrismaService`, `GoogleCalendarService`, `WhatsappService`.

- [ ] **Step 4: Test + typecheck**

```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/api typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/notifications/reminders.cron.ts apps/api/src/notifications/reminders.cron.spec.ts apps/api/src/google-calendar
git commit -m "feat(notifications): reminders cron reads Calendar events by ICS ID"
```

---

### Task 5: `TriageService` + tests

**Files:**
- Create: `apps/api/src/admin/triage/triage.service.ts`
- Create: `apps/api/src/admin/triage/triage.service.spec.ts`

**Goal:** Compute the admin's alert list on-the-fly from existing data.

Response shape:

```typescript
type TriageAlert = {
  id: string;
  type: AlertType;  // from @ics-select/shared
  severity: 'urgent' | 'attention' | 'scheduled';
  member: { id: string; name: string; pictureUrl: string | null };
  targetId: string | null;
  summary: string;
  occurredAt: string;  // ISO
  // UI hints for the dismiss key
  dismissKey: string;  // `${type}:${targetId ?? member.id}`
};

type TriageResponse = {
  alerts: TriageAlert[];
  cohortStrip: Array<{
    userId: string;
    name: string;
    pictureUrl: string | null;
    percentThisWeek: number;
    hasAlert: boolean;
  }>;
  cycleInfo: {
    cycleId: string;
    cycleName: string;
    weekNumber: number;
    weeksTotal: number;
    daysUntilWeekEnds: number;
  } | null;
};
```

Alert computation rules (matching spec §5.1 table):

| Type | Severity | Rule |
|---|---|---|
| `STUCK_RECENT` | urgent | Any WeeklyPlanItem with `outcome = STUCK` updated in last 48h. One alert per member (most recent stuck). |
| `DISAPPEARED` | urgent | Member has 0 positive outcomes in last 72h AND has scheduled items that have passed. |
| `CALENDAR_BROKEN` | urgent | Member's GoogleAccount exists but last refresh token fetch errored recently. Skip if we don't track that yet; defer. |
| `STUCK_REPEATEDLY` | attention | Member has 2+ STUCK items in the current week. |
| `FINISHED_EARLY` | attention | Member has 100% of current week's items positive AND ≥2 days until weekEnd. |
| `SKIPPED_RETROS` | attention | Member has 2 consecutive weeks without a `WeeklyRetro`. |
| `PLAN_PENDING` | scheduled | Current week ends in ≤3 days AND no `WeeklyPlan` exists with weekStart = next week. |

Dismissals in `DismissedAlert` (24h snooze) filtered out before returning.

- [ ] **Step 1: Write the spec**

Create `apps/api/src/admin/triage/triage.service.spec.ts`. Cover:
- Empty result when no active cycle.
- `STUCK_RECENT` generated when a member has a recent STUCK item.
- `FINISHED_EARLY` generated when 100% + days remaining.
- `PLAN_PENDING` generated when week ends in 2 days and next week has no plan.
- Dismissed alerts filtered out.
- `cohortStrip` has one row per member with `percentThisWeek` and `hasAlert` flag.

Use Prisma mocks similar to previous services. Example skeleton:

```typescript
import { Test } from '@nestjs/testing';
import { TriageService } from './triage.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const makePrismaMock = () => ({
  cycle: { findFirst: jest.fn() },
  cycleMembership: { findMany: jest.fn() },
  weeklyPlan: { findMany: jest.fn() },
  weeklyPlanItem: { findMany: jest.fn() },
  weeklyRetro: { findMany: jest.fn() },
  dismissedAlert: { findMany: jest.fn() },
});

describe('TriageService', () => {
  // ... 6+ tests
});
```

Run: fails.

- [ ] **Step 2: Implement the service**

Write `apps/api/src/admin/triage/triage.service.ts` with method `getTriage(now: Date = new Date())`. Pull in active cycle, all its members, week window, plans, items, retros, dismissed alerts. Run each rule, build the alerts array sorted by severity (urgent first) then by `occurredAt` desc. Build the cohort strip from the same data.

Keep the file under ~300 lines — each rule is a small helper function.

Run tests; iterate until all pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/admin/triage
git commit -m "feat(api): TriageService — alerts computed on-the-fly from existing data"
```

---

### Task 6: Triage controller + module + alerts dismiss

**Files:**
- Create: `apps/api/src/admin/triage/triage.controller.ts`
- Create: `apps/api/src/admin/triage/triage.module.ts`
- Create: `apps/api/src/admin/alerts/alerts.service.ts`
- Create: `apps/api/src/admin/alerts/alerts.service.spec.ts`
- Create: `apps/api/src/admin/alerts/alerts.controller.ts`
- Create: `apps/api/src/admin/alerts/alerts.module.ts`
- Create: `apps/api/src/admin/alerts/dto.ts`
- Create: `apps/api/src/admin/admin.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Triage controller**

```typescript
import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TriageService } from './triage.service';

@Controller('admin')
@Roles('ADMIN')
export class TriageController {
  constructor(private readonly triage: TriageService) {}

  @Get('triage')
  getTriage() {
    return this.triage.getTriage();
  }
}
```

(Use the actual `@Roles` decorator path used elsewhere in the codebase.)

- [ ] **Step 2: AlertsService — dismiss**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AlertType } from '@ics-select/shared';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async dismiss(userId: string, input: { alertType: AlertType; targetId: string }) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    return this.prisma.dismissedAlert.create({
      data: {
        userId,
        alertType: input.alertType,
        targetId: input.targetId,
        expiresAt,
      },
    });
  }
}
```

Spec: 1 test verifying the row is created with correct fields.

- [ ] **Step 3: Alerts controller + DTO**

```typescript
// dto.ts
import { z } from 'zod';
import { ALERT_TYPES } from '@ics-select/shared';

export const DismissAlertSchema = z.object({
  alertType: z.enum(ALERT_TYPES),
  targetId: z.string().min(1),
});

// alerts.controller.ts
@Controller('admin/alerts')
@Roles('ADMIN')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Post('dismiss')
  dismiss(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const input = DismissAlertSchema.parse(body);
    return this.alerts.dismiss(user.sub, input);
  }
}
```

- [ ] **Step 4: Admin module**

```typescript
// admin.module.ts
import { Module } from '@nestjs/common';
import { TriageModule } from './triage/triage.module';
import { AlertsModule } from './alerts/alerts.module';

@Module({ imports: [TriageModule, AlertsModule] })
export class AdminModule {}
```

Each subfolder has its own Module file wiring its Service + Controller + any deps.

Add `AdminModule` to `AppModule.imports`.

- [ ] **Step 5: Run full API suite**

```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/api typecheck
```

Expected: 111 (PR 2c) + new tests = 120+.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/admin apps/api/src/app.module.ts
git commit -m "feat(api): GET /admin/triage + POST /admin/alerts/dismiss (admin module)"
```

---

### Task 7: Cycle overview service + endpoint

**Files:**
- Create: `apps/api/src/admin/cycle/cycle-overview.service.ts`
- Create: `apps/api/src/admin/cycle/cycle-overview.service.spec.ts`
- Create: `apps/api/src/admin/cycle/cycle-overview.controller.ts`
- Create: `apps/api/src/admin/cycle/cycle-overview.module.ts`
- Modify: `apps/api/src/admin/admin.module.ts` (import CycleOverviewModule)

Response shape:

```typescript
type CycleOverviewResponse = {
  cycle: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    status: 'ACTIVE' | 'ARCHIVED';
    rankingVisibleToMembers: boolean;
    weekNumber: number;         // e.g. 4
    weeksTotal: number;         // e.g. 12
  };
  members: Array<{
    userId: string;
    name: string;
    pictureUrl: string | null;
    track: Track | null;
    percentThisWeek: number;    // 0-100
    done: number;               // this week
    total: number;              // this week
    hasAlert: boolean;          // shortcut for triage lookup
  }>;
  heatmap: {
    weeks: Array<{ index: number; label: string; startsAt: string }>;   // last 6 weeks
    rows: Array<{
      userId: string;
      name: string;
      cells: number[];   // per week: 0..100
    }>;
  };
};
```

- [ ] **Step 1: Write the spec (3-5 focused tests)**

- [ ] **Step 2: Implement**

Logic: given `cycleId`, fetch the cycle + memberships + last 6 weeks of PUBLISHED plans per member + their items. Compute percent per (member, week). Build the heatmap matrix. `weekNumber` is the number of full weeks since `startsAt` (capped at `weeksTotal`). `percentThisWeek` is computed on the active week only.

- [ ] **Step 3: Controller**

```typescript
@Controller('admin/cycle')
@Roles('ADMIN')
export class CycleOverviewController {
  constructor(private readonly service: CycleOverviewService) {}

  @Get(':id')
  overview(@Param('id') id: string) {
    return this.service.getOverview(id);
  }
}
```

- [ ] **Step 4: Module + wire**

Add `CycleOverviewModule` to `AdminModule.imports`.

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/api typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/admin/cycle apps/api/src/admin/admin.module.ts
git commit -m "feat(api): GET /admin/cycle/:id — members + heatmap"
```

---

### Task 8: Extend `PATCH /cycles/:id` to toggle `rankingVisibleToMembers`

**Files:**
- Modify: `apps/api/src/cycles/cycles.controller.ts`
- Modify: `apps/api/src/cycles/cycles.service.ts`
- Modify: `apps/api/src/cycles/cycles.service.spec.ts`
- Modify: `apps/api/src/cycles/dto.ts`

- [ ] **Step 1: Extend UpdateCycleSchema**

Add `rankingVisibleToMembers: z.boolean().optional()` to whatever Zod schema powers the existing PATCH endpoint.

- [ ] **Step 2: Extend `CyclesService.update` method**

Pass the new field through. No new method needed — just thread it through.

- [ ] **Step 3: Spec**

Add one test verifying the toggle is persisted.

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/cycles
git commit -m "feat(api): PATCH /cycles/:id supports rankingVisibleToMembers toggle"
```

---

### Task 9: Admin shell — sidebar + layout

**Files:**
- Create: `apps/web/components/admin-shell/sidebar-admin.tsx`
- Create: `apps/web/components/admin-shell/admin-shell.tsx`
- Create: `apps/web/app/(admin)/layout.tsx`
- Delete: `apps/web/app/(app)/admin/page.tsx` (if it exists and collides with new `/admin`)

**Design rules:**
- Sidebar is 240px, fixed left, `bg-paper` with right border `1px rule`.
- Items: Triage (Bell icon) · Cohort (Users icon) · Plans (CalendarDays icon) · Library (BookOpen icon) · Cycles (CircleDot icon) · AI (Sparkles icon — lucide-react).
- Active item: `bg-paper-warm` + left indicator 3px `--focus` indigo + bold label.
- Member shell stays its own thing at `(member)` — this only affects admin.
- **Source Serif 4** for the admin app title / section headers. Inter for labels. IBM Plex Mono for counts (e.g. "5" alerts badge).
- Active indicator is indigo `--focus` because the current nav item is "where the admin is acting" (momentum).

- [ ] **Step 1: Write `sidebar-admin.tsx`**

Typed nav items, active-detection via `usePathname` (with the same nullish guard we learned on member topbar). Active treatment = `bg-paper-warm border-l-2 border-focus pl-2.5` (compensating -ml-0.5 to sit flush). Everything else = `text-ink-soft hover:bg-paper-warm`.

- [ ] **Step 2: Write `admin-shell.tsx`**

Wraps sidebar + main content. Main pads 48px top, 32px horizontal. Max width cap: none (admin surfaces want breathing room).

- [ ] **Step 3: `(admin)/layout.tsx`**

Reads `useAuth()`, redirects to `/login` if no user, to `/me` if role === 'MEMBER'. Renders `<AdminShell>{children}</AdminShell>` only for ADMIN.

- [ ] **Step 4: Delete colliding `(app)/admin/page.tsx` if any**

```bash
ls 'apps/web/app/(app)/admin/page.tsx' 2>/dev/null && rm 'apps/web/app/(app)/admin/page.tsx' && echo "deleted" || echo "no direct page.tsx; no-op"
```

If a file existed at `(app)/admin/page.tsx`, its removal opens the slot for `(admin)/admin/page.tsx`.

- [ ] **Step 5: Typecheck + build**

```bash
pnpm --filter @ics-select/web typecheck
pnpm --filter @ics-select/web build
```

Expected: build succeeds. Legacy admin pages under `(app)/admin/*` continue to work; they'll be rewritten in PR 3b/3c.

- [ ] **Step 6: Commit**

```bash
git add 'apps/web/app/(admin)' 'apps/web/app/(app)/admin' apps/web/components/admin-shell
git commit -m "feat(web): (admin) shell + sidebar (Source Serif 4 tool tone)"
```

---

### Task 10: Admin data hooks

**Files:**
- Create: `apps/web/lib/queries/admin-triage.ts`
- Create: `apps/web/lib/queries/admin-cycle.ts`

Mirror existing hook patterns (`me-cohort.ts`, `me-home.ts`). Types must mirror the backend response shapes defined in Tasks 5 + 7.

`useAdminTriage()` — 60s refetch (alerts change as members work).
`useAdminCycleOverview(cycleId)` — standard query.
`useToggleRanking()` — mutation hitting `PATCH /cycles/:id`.
`useDismissAlert()` — mutation hitting `POST /admin/alerts/dismiss`.

- [ ] **Step 1: Write the files, one at a time.**

- [ ] **Step 2: Typecheck.**

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/queries/admin-triage.ts apps/web/lib/queries/admin-cycle.ts
git commit -m "feat(web): admin data hooks (triage, cycle overview, dismiss, toggle)"
```

---

### Task 11: `/admin` triage home page

**Files:**
- Create: `apps/web/components/admin/triage-alert-row.tsx`
- Create: `apps/web/components/admin/cohort-strip.tsx`
- Create: `apps/web/app/(admin)/admin/page.tsx`

**Design (from spec §5.1):**

- H1 Source Serif 4 "N things need your attention today" (N = urgent + attention count).
- Grouped alerts by severity: `URGENT (N)` / `NEEDS ATTENTION (N)` / `SCHEDULED (N)` — each a SectionLabel with the count in mono.
- Each alert row:
  - Left border 3px colored by severity (vinho urgent / amber attention / gray scheduled).
  - Avatar (initials 28px, `bg-paper-warm` serif weight).
  - Member name (Source Serif 4 semibold) + "·" + verb (Inter).
  - Detail line (Inter `text-ink-soft` 12px).
  - Timestamp + action links (`whatsapp ↗` / `note 1:1 →` / `bump next plan →` / `start draft →` / `see member →` / `× dismiss`).
- Cohort strip below: horizontal scroll of 12 avatars with status dot + name + % (uses `cohortStrip` from triage endpoint).
- Cycle info at the bottom: `2026.1 · week 4 of 12 · 3 days until week ends`.
- Empty state: `Good morning, Davi. You're all caught up.` + cohort strip still shown.

- [ ] **Step 1: `triage-alert-row.tsx`**

Render one alert. Props: `{ alert, onDismiss }`. Action links should be real `<a href>` for WhatsApp (wa.me URL composed from `member.phone` if available) and `<Link>` for internal routes. For "start draft" / "bump next plan" / "see member" internal routes, link to future admin pages — even if they don't exist yet (404 OK), wire them up so PR 3b/3c just need to create pages.

Keep logic to "what action does this alert type hint at" — map alert types to actions:

```typescript
function actionsFor(alert: TriageAlert): Array<{ label: string; href: string }> {
  switch (alert.type) {
    case 'STUCK_RECENT':
    case 'STUCK_REPEATEDLY':
      return [
        { label: 'see member →', href: `/admin/member/${alert.member.id}` },
      ];
    case 'DISAPPEARED':
      return [
        { label: 'whatsapp ↗', href: `https://wa.me/...` /* compose with phone if available */ },
        { label: 'see member →', href: `/admin/member/${alert.member.id}` },
      ];
    case 'FINISHED_EARLY':
      return [
        { label: 'bump next plan →', href: `/admin/member/${alert.member.id}/plan/new` },
      ];
    case 'PLAN_PENDING':
      return [
        { label: 'start draft →', href: `/admin/member/${alert.member.id}/plan/new` },
      ];
    case 'SKIPPED_RETROS':
      return [
        { label: 'whatsapp ↗', href: `https://wa.me/...` },
        { label: 'see member →', href: `/admin/member/${alert.member.id}` },
      ];
    case 'CALENDAR_BROKEN':
      return [{ label: 'see member →', href: `/admin/member/${alert.member.id}` }];
    default:
      return [];
  }
}
```

For the WhatsApp URL: if `alert.member` has a phone (not returned by the triage endpoint currently — defer to PR 3c or add a phone field to TriageAlert). For now, the href can be `#` and display with `target="_blank"` — the placeholder reminds us to wire it up.

- [ ] **Step 2: `cohort-strip.tsx`**

Horizontal scroll list of cohort members. Each: avatar 32px + name (truncated) + mono percentage + colored dot for alert state (vinho if hasAlert = true else neutral).

- [ ] **Step 3: `/admin/page.tsx`**

Fetches `useAdminTriage()`, renders the groups. Empty-state handles gracefully.

- [ ] **Step 4: Typecheck + build**

- [ ] **Step 5: Commit**

```bash
git add 'apps/web/app/(admin)/admin' apps/web/components/admin
git commit -m "feat(web): /admin triage home (urgent + attention + scheduled + cohort strip)"
```

---

### Task 12: `/admin/cycle/[id]` cycle page

**Files:**
- Create: `apps/web/components/admin/cycle-members-grid.tsx`
- Create: `apps/web/components/admin/cohort-heatmap.tsx`
- Create: `apps/web/components/admin/ranking-toggle.tsx`
- Create: `apps/web/app/(admin)/admin/cycle/[id]/page.tsx`

**Design (from spec §5.2):**

- Header: `Cycle 2026.1 · Active · 12 members · week 4 of 12 · 3 days until week ends` (Source Serif 4 title, Inter meta).
- Inline toggle: `Cohort ranking: [ ○ hidden ]` — clickable switch. Optimistic update via mutation.
- Members grid: 4 col desktop, 2 col mobile. Card per member: avatar, name (Source Serif 4), track (Pill variant="soft"), `% · N/M` (Inter mono), alert dot (vinho if hasAlert else none).
- Heatmap: GitHub contribution-graph style. Header row = week labels. Each row = one member with 6 cells colored by percent (thresholds: 0 gray, 1-25 light, 26-50 medium, 51-80 dark, 81-100 black). Row label = member name (Source Serif 4 semibold).

- [ ] **Step 1: Write `ranking-toggle.tsx`**

Small component. Uses `useToggleRanking` mutation. Renders a pill-styled switch + label.

- [ ] **Step 2: Write `cycle-members-grid.tsx`**

Grid of member cards. Click goes to `/admin/member/[id]` (future PR 3c will build that page). Alert dot: `w-2 h-2 rounded-full bg-outcome-stuck` if `hasAlert`, else nothing.

- [ ] **Step 3: Write `cohort-heatmap.tsx`**

A CSS grid with `grid-template-columns: auto repeat(6, 1fr)`. First column is the member name (right-aligned, Source Serif 4). Next 6 columns are the cells. Each cell has `bg-rule` (0), `bg-rule/50 + border` light variants, up to `bg-ink` for 81-100. Tooltip on hover with `"Week X · 7/8 items"`.

- [ ] **Step 4: Write `/admin/cycle/[id]/page.tsx`**

```tsx
'use client';
import { use } from 'react';
import { useAdminCycleOverview } from '../../../../../lib/queries/admin-cycle';
import { RankingToggle } from '../../../../../components/admin/ranking-toggle';
import { CycleMembersGrid } from '../../../../../components/admin/cycle-members-grid';
import { CohortHeatmap } from '../../../../../components/admin/cohort-heatmap';
import { Eyebrow } from '../../../../../components/ui/eyebrow';

export default function AdminCyclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data } = useAdminCycleOverview(id);
  if (!data) return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="flex-1 min-w-0">
          <Eyebrow>Cycle · {data.cycle.status}</Eyebrow>
          <h1 className="mt-2 font-serif-tool text-4xl font-semibold tracking-tight">
            {data.cycle.name} · week {data.cycle.weekNumber} of {data.cycle.weeksTotal}
          </h1>
          <p className="mt-2 font-mono text-xs text-ink-mute">
            {data.members.length} members
          </p>
        </div>
        <RankingToggle cycleId={data.cycle.id} checked={data.cycle.rankingVisibleToMembers} />
      </header>

      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold mb-4">
          Members
        </h2>
        <CycleMembersGrid members={data.members} />
      </section>

      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold mb-4">
          Cohort heatmap · last 6 weeks
        </h2>
        <CohortHeatmap weeks={data.heatmap.weeks} rows={data.heatmap.rows} />
      </section>
    </div>
  );
}
```

Note `font-serif-tool` for the cycle header — Source Serif 4 "tool tone" from PR 2a.

- [ ] **Step 5: Typecheck + build**

- [ ] **Step 6: Commit**

```bash
git add 'apps/web/app/(admin)/admin/cycle' apps/web/components/admin
git commit -m "feat(web): /admin/cycle/[id] (header + ranking toggle + members grid + heatmap)"
```

---

### Task 13: Final regression gate

**Files:** verification only.

- [ ] **Step 1: Run gates**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all clean. Api tests ~120-130 pass (111 from PR 2c + new tests from Tasks 1/2/3/4/5/6/7/8).

- [ ] **Step 2: Verify routes**

Check `pnpm --filter @ics-select/web build` output listing — should include `/admin`, `/admin/cycle/[id]`, plus the legacy `(app)/admin/*` routes still work.

- [ ] **Step 3: Spot-check in dev**

Start `pnpm dev`, navigate to `http://localhost:3000/admin` (after logging in as admin). Verify the new shell + triage page renders.

- [ ] **Step 4: Capture commit list**

```bash
git log --oneline main..HEAD
```

- [ ] **Step 5: Report.**

---

## Self-review

**Spec coverage:**
- §3.1 admin sidebar: Task 9 ✅
- §5.1 triage home: Tasks 5, 6, 11 ✅
- §5.2 cycle page (members grid + heatmap + ranking toggle): Tasks 7, 8, 12 ✅ (classes deferred)
- §8 endpoints: `/admin/triage`, `/admin/alerts/dismiss`, `/admin/cycle/:id`, `PATCH /cycles/:id` rankingToggle ✅
- §12 risks: "ICS ID parse quebrar se admin apagar evento no Calendar manualmente" → Task 4 reminder cron uses `try/catch` per member ✅

**Placeholder scan:**
- No TBD/TODO. All tasks show concrete code or exact commands.
- `wa.me` href placeholder `#` in Task 11 acknowledged — TriageAlert doesn't expose phone (that's a future enhancement; noted in task text).
- `CALENDAR_BROKEN` alert type is listed but its computation "skip if we don't track refresh token failures yet; defer" — acceptable explicit deferral.

**Type consistency:**
- `TriageAlert.type` = `AlertType` from `@ics-select/shared` (defined in PR 1).
- `CohortStripEntry` in triage response matches shape used in `cohort-strip.tsx` component.
- `CycleOverviewResponse.heatmap.rows[].cells` are `number[]` (0-100), rendered by `CohortHeatmap` with documented thresholds.
- `useToggleRanking` mutation body matches `UpdateCycleSchema` extension (boolean field).

**Ambiguities to verify during implementation:**
- `@Roles('ADMIN')` decorator path: Check where existing admin-only controllers use it (`grep -rn "@Roles" apps/api/src`).
- `CurrentUser` / `JwtStrategyPayload` paths: same as PR 2b/2c convention.
- If the scheduler expects busyByDay keyed by weekday index (0-6) instead of ISO date string, adapt Task 2 Step 3 accordingly.
- If `GoogleCalendarService.getFreeBusy` already returns a differently-shaped payload, adapt the grouping loop.

**Out-of-scope correctly deferred:**
- Plan editor 3-panel: PR 3b.
- Library / topics / cycles list / ai-usage / member detail: PR 3c.
- Classes management: PR 3c.
- Admin chat + diagnose UI: PR 4.
- `CALENDAR_BROKEN` alert: needs OAuth health tracking — defer.
- Retro reminder cron (Fri 18h notification): PR 4.
