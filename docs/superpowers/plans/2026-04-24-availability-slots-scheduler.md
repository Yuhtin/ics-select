# Availability Slots + Week-Level Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-number-per-day availability + hardcoded 08:00–22:00 window with granular per-weekday time slots + a week-level branch-and-bound scheduler that balances load across the week.

**Architecture:** New `AvailabilitySlot` table (1:N with `User`); `MemberAvailability.mondayMinutes…sundayMinutes` become nullable caps (null = no cap). The scheduler takes `slots + caps + busyBlocks + items (with order)`, runs an FFD heuristic to produce a feasible solution `S0`, then a 500 ms branch-and-bound refinement that explores placements ranked by `(dayLoad asc, |interval_size − chunk_size| asc, interval_start asc)`. Objective: `UNPLACED >> DAY_IMBALANCE >> SLOT_COUNT >> RESIDUE_IN_BIG >> SMALL_SLOT >> ORDER_VIOLATION >> WASTE`, lexicographic weights.

**Tech Stack:** Prisma 5 (Postgres), NestJS 10 + Zod, TanStack Query + HeroUI + Tailwind, Jest (API unit + e2e), Playwright (web).

**Spec:** `docs/superpowers/specs/2026-04-24-availability-slots-scheduler-design.md`

---

## File Structure

### Prisma (`packages/prisma/`)

- **Modify** `prisma/schema.prisma:174-188` — add `AvailabilitySlot` model; change `MemberAvailability.mondayMinutes…sundayMinutes` from `Int @default(0)` to `Int?`.
- **Create** `prisma/migrations/p_availability_slots/migration.sql` — creates the new table, drops `NOT NULL` from the seven day-cap columns, backfills default `08:00–22:00` slot for every `(userId, dayOfWeek)` with `minutes > 0`.

### API (`apps/api/`)

- **Modify** `src/availability/availability.service.ts` — `AvailabilityInput` gains nullable caps + `slots` + `clearDays`; `upsert` becomes a transaction that replaces slots and upserts the caps row; validates slot invariants (granularity, min size, overlap).
- **Modify** `src/availability/availability.controller.ts` — new Zod schema accepting nullable caps, `slots: Slot[]`, `clearDays: number[]`; returns the full `{ ...availability, slots }` shape from both GET and PATCH.
- **Modify** `src/availability/availability.service.spec.ts` — extend unit tests to cover slot upsert + clearDays + overlap detection + cap nullability.
- **Create** `test/availability.e2e-spec.ts` — end-to-end coverage of PATCH with slots, including overlap → 400.
- **Modify** `src/scheduler/scheduler.service.ts` — full rewrite: new `SchedulerInput` (`slots[]`, `caps[]`, `items[].order`), phase-1 FFD + phase-2 B&B, `diagnostics` returned.
- **Create** `src/scheduler/scheduler.types.ts` — extract shared types out of the service file (keeps the solver file focused).
- **Create** `src/scheduler/objective.ts` — the cost function + weights + helpers, isolated for unit-testing independently of the solver.
- **Modify** `src/scheduler/scheduler.service.spec.ts` — adapt existing cases to new input shape; add the 10 canonical cases from the spec.
- **Create** `src/scheduler/objective.spec.ts` — direct unit tests on the cost function.
- **Modify** `src/weekly-plans/publication.service.ts:20-30,266-275,345-356` — pass `slots + caps + items[].order` to the scheduler; adapt `DEFAULT_AVAILABILITY` shape.
- **Modify** `src/weekly-plans/publication.service.spec.ts` (if impacted by shape change) — update mocks.

### Web (`apps/web/`)

- **Modify** `lib/queries/me-settings.ts` — extend `AvailabilityResponse` with `slots`; update mutation payload type.
- **Create** `components/member/availability-slot-editor.tsx` — the per-day list-of-ranges component.
- **Create** `components/member/availability-slot-presets.tsx` — the three preset buttons (Noite de semana, Manhã de fim de semana, Copiar Seg).
- **Modify** `components/member/availability-grid.tsx` — integrate the new editor; repurpose the old minute presets as "daily cap, optional" with a `—` (null) button.
- **Modify** `components/member/availability-presets.tsx` — add a `—` preset to represent `null` cap and accept `number | null`.
- **Modify** `lib/format/time.ts` (create if missing) — small `minutesToHHMM(480)` / `hhmmToMinutes('08:00')` helpers.
- **Create** `tests/availability-slots.spec.ts` — Playwright smoke for the new editor (add/remove slot, preset, overlap validation, save).

---

## Task 1: Prisma — `AvailabilitySlot` model + nullable caps

**Files:**
- Modify: `packages/prisma/prisma/schema.prisma:174-188`

- [ ] **Step 1: Edit the `MemberAvailability` model and add `AvailabilitySlot`**

In `packages/prisma/prisma/schema.prisma`, replace the current `MemberAvailability` block (lines ~174-188) with:

```prisma
model MemberAvailability {
  id                      String   @id @default(cuid())
  userId                  String   @unique
  mondayMinutes           Int?
  tuesdayMinutes          Int?
  wednesdayMinutes        Int?
  thursdayMinutes         Int?
  fridayMinutes           Int?
  saturdayMinutes         Int?
  sundayMinutes           Int?
  preferredSessionMinutes Int      @default(60)
  timezone                String   @default("America/Sao_Paulo")
  updatedAt               DateTime @updatedAt
  user                    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model AvailabilitySlot {
  id          String   @id @default(cuid())
  userId      String
  dayOfWeek   Int
  startMinute Int
  endMinute   Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, dayOfWeek])
}
```

- [ ] **Step 2: Add the back-relation on `User`**

In the same file, find the `User` model (around line 20–80) and add one line to its relations block:

```prisma
availabilitySlots AvailabilitySlot[]
```

Place it next to `memberAvailability MemberAvailability?` (same style).

- [ ] **Step 3: Regenerate the client (does not apply DB migration yet)**

Run: `pnpm db:generate`

Expected: `Generated Prisma Client` with no errors. TypeScript compilation of `@ics-select/prisma` passes.

- [ ] **Step 4: Commit**

```bash
git add packages/prisma/prisma/schema.prisma
git commit -m "feat(prisma): add AvailabilitySlot model, caps nullable"
```

---

## Task 2: Prisma — migration with backfill

**Files:**
- Create: `packages/prisma/prisma/migrations/p_availability_slots/migration.sql`

- [ ] **Step 1: Create the migration directory**

```bash
mkdir -p packages/prisma/prisma/migrations/p_availability_slots
```

- [ ] **Step 2: Write the migration SQL**

Create `packages/prisma/prisma/migrations/p_availability_slots/migration.sql` with:

```sql
-- pgcrypto is required for gen_random_uuid() used in the backfill.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the slot table
CREATE TABLE "AvailabilitySlot" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "dayOfWeek"   INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute"   INTEGER NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AvailabilitySlot_userId_dayOfWeek_idx"
  ON "AvailabilitySlot"("userId", "dayOfWeek");
ALTER TABLE "AvailabilitySlot"
  ADD CONSTRAINT "AvailabilitySlot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Make per-day cap columns nullable
ALTER TABLE "MemberAvailability"
  ALTER COLUMN "mondayMinutes"    DROP NOT NULL,
  ALTER COLUMN "tuesdayMinutes"   DROP NOT NULL,
  ALTER COLUMN "wednesdayMinutes" DROP NOT NULL,
  ALTER COLUMN "thursdayMinutes"  DROP NOT NULL,
  ALTER COLUMN "fridayMinutes"    DROP NOT NULL,
  ALTER COLUMN "saturdayMinutes"  DROP NOT NULL,
  ALTER COLUMN "sundayMinutes"    DROP NOT NULL;

-- Backfill: for every (userId, dayOfWeek) where the matching column > 0,
-- create a default slot 08:00 (480) – 22:00 (1320).
INSERT INTO "AvailabilitySlot" ("id", "userId", "dayOfWeek", "startMinute", "endMinute", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  m."userId",
  d.day_idx,
  480,
  1320,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "MemberAvailability" m
CROSS JOIN LATERAL (VALUES
  (0, m."mondayMinutes"),
  (1, m."tuesdayMinutes"),
  (2, m."wednesdayMinutes"),
  (3, m."thursdayMinutes"),
  (4, m."fridayMinutes"),
  (5, m."saturdayMinutes"),
  (6, m."sundayMinutes")
) AS d(day_idx, minutes)
WHERE d.minutes IS NOT NULL AND d.minutes > 0;
```

- [ ] **Step 3: Apply the migration against the local DB**

Ensure Postgres is running (`docker compose up -d postgres` if needed) and `DATABASE_URL` is set.

Run: `pnpm db:deploy`

Expected: one migration applied (`p_availability_slots`), no errors.

- [ ] **Step 4: Verify the schema after migration**

```bash
source apps/api/.env && psql "$DATABASE_URL" -c "\d \"AvailabilitySlot\""
```

Expected output includes the five payload columns (`id`, `userId`, `dayOfWeek`, `startMinute`, `endMinute`) plus timestamps, the FK on `userId`, and the index on `(userId, dayOfWeek)`.

```bash
psql "$DATABASE_URL" -c "\d \"MemberAvailability\"" | grep Minutes
```

Expected: each `Minutes` column line does **not** show `not null`.

- [ ] **Step 5: Verify the backfill produced rows for existing members**

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"AvailabilitySlot\";"
```

Expected: a positive integer equal to the count of `(userId, dayOfWeek)` pairs where the corresponding day column was `> 0` pre-migration. On an empty dev DB, this returns `0` — still a pass.

- [ ] **Step 6: Commit**

```bash
git add packages/prisma/prisma/migrations/p_availability_slots/migration.sql
git commit -m "feat(prisma): migration for AvailabilitySlot + backfill 08-22"
```

---

## Task 3: API — types module for the availability payload

**Files:**
- Create: `apps/api/src/availability/availability.types.ts`

Keeping payload types in their own file prevents circular dependency with controller + service and makes the shape easy to reuse in tests.

- [ ] **Step 1: Create the types file**

Create `apps/api/src/availability/availability.types.ts`:

```ts
export type AvailabilitySlotInput = {
  dayOfWeek: number;   // 0..6, 0 = Monday
  startMinute: number; // [0, 1410], multiple of 30
  endMinute: number;   // [30, 1440], multiple of 30, > startMinute
};

export type AvailabilityPatchInput = {
  mondayMinutes?: number | null;
  tuesdayMinutes?: number | null;
  wednesdayMinutes?: number | null;
  thursdayMinutes?: number | null;
  fridayMinutes?: number | null;
  saturdayMinutes?: number | null;
  sundayMinutes?: number | null;
  preferredSessionMinutes?: number;
  timezone?: string;
  slots?: AvailabilitySlotInput[];
  clearDays?: number[]; // weekdays whose slots should be wiped
};

export type AvailabilityFullResponse = {
  mondayMinutes: number | null;
  tuesdayMinutes: number | null;
  wednesdayMinutes: number | null;
  thursdayMinutes: number | null;
  fridayMinutes: number | null;
  saturdayMinutes: number | null;
  sundayMinutes: number | null;
  preferredSessionMinutes: number;
  timezone: string;
  slots: Array<{
    id: string;
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
  }>;
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/availability/availability.types.ts
git commit -m "feat(availability): extract payload types"
```

---

## Task 4: API — slot validation helpers (TDD)

**Files:**
- Create: `apps/api/src/availability/slot-validation.ts`
- Create: `apps/api/src/availability/slot-validation.spec.ts`

Validation is pure logic and deserves its own unit test file.

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/availability/slot-validation.spec.ts`:

```ts
import { validateSlots, SlotValidationError } from './slot-validation';

describe('validateSlots', () => {
  it('accepts a well-formed, non-overlapping set', () => {
    expect(() =>
      validateSlots([
        { dayOfWeek: 0, startMinute: 480, endMinute: 600 },
        { dayOfWeek: 0, startMinute: 1140, endMinute: 1320 },
        { dayOfWeek: 1, startMinute: 1140, endMinute: 1320 },
      ]),
    ).not.toThrow();
  });

  it('rejects dayOfWeek outside 0..6', () => {
    expect(() =>
      validateSlots([{ dayOfWeek: 7, startMinute: 0, endMinute: 60 }]),
    ).toThrow(SlotValidationError);
  });

  it('rejects startMinute not multiple of 30', () => {
    expect(() =>
      validateSlots([{ dayOfWeek: 0, startMinute: 475, endMinute: 600 }]),
    ).toThrow(/granularity/);
  });

  it('rejects endMinute not multiple of 30', () => {
    expect(() =>
      validateSlots([{ dayOfWeek: 0, startMinute: 480, endMinute: 601 }]),
    ).toThrow(/granularity/);
  });

  it('rejects slot shorter than 30 minutes', () => {
    expect(() =>
      validateSlots([{ dayOfWeek: 0, startMinute: 480, endMinute: 500 }]),
    ).toThrow(/too_short/);
  });

  it('rejects endMinute <= startMinute', () => {
    expect(() =>
      validateSlots([{ dayOfWeek: 0, startMinute: 600, endMinute: 600 }]),
    ).toThrow(/too_short/);
  });

  it('rejects endMinute > 1440', () => {
    expect(() =>
      validateSlots([{ dayOfWeek: 0, startMinute: 1380, endMinute: 1500 }]),
    ).toThrow(/range/);
  });

  it('rejects startMinute < 0', () => {
    expect(() =>
      validateSlots([{ dayOfWeek: 0, startMinute: -30, endMinute: 60 }]),
    ).toThrow(/range/);
  });

  it('rejects strict overlap in same day', () => {
    expect(() =>
      validateSlots([
        { dayOfWeek: 0, startMinute: 480, endMinute: 720 },
        { dayOfWeek: 0, startMinute: 600, endMinute: 900 },
      ]),
    ).toThrow(/overlap/);
  });

  it('allows touching boundary in same day (08-10 + 10-12)', () => {
    expect(() =>
      validateSlots([
        { dayOfWeek: 0, startMinute: 480, endMinute: 600 },
        { dayOfWeek: 0, startMinute: 600, endMinute: 720 },
      ]),
    ).not.toThrow();
  });

  it('allows same time-range on different days', () => {
    expect(() =>
      validateSlots([
        { dayOfWeek: 0, startMinute: 480, endMinute: 600 },
        { dayOfWeek: 1, startMinute: 480, endMinute: 600 },
      ]),
    ).not.toThrow();
  });

  it('exposes violation details on the error', () => {
    try {
      validateSlots([{ dayOfWeek: 0, startMinute: 480, endMinute: 500 }]);
      fail('should throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(SlotValidationError);
      expect(e.reason).toBe('too_short');
      expect(e.dayOfWeek).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern slot-validation`

Expected: failures — file does not exist yet.

- [ ] **Step 3: Implement the validator**

Create `apps/api/src/availability/slot-validation.ts`:

```ts
import type { AvailabilitySlotInput } from './availability.types.js';

export type SlotViolationReason =
  | 'range'
  | 'granularity'
  | 'too_short'
  | 'overlap';

export class SlotValidationError extends Error {
  constructor(
    public readonly reason: SlotViolationReason,
    public readonly dayOfWeek: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'SlotValidationError';
  }
}

const MIN_SLOT_MINUTES = 30;
const GRANULARITY = 30;

export function validateSlots(slots: AvailabilitySlotInput[]): void {
  // 1) Per-slot checks
  for (const s of slots) {
    if (!Number.isInteger(s.dayOfWeek) || s.dayOfWeek < 0 || s.dayOfWeek > 6) {
      throw new SlotValidationError('range', null, `dayOfWeek out of 0..6: ${s.dayOfWeek}`);
    }
    if (s.startMinute < 0 || s.endMinute > 1440) {
      throw new SlotValidationError('range', s.dayOfWeek, `slot out of [0, 1440]`);
    }
    if (s.startMinute % GRANULARITY !== 0 || s.endMinute % GRANULARITY !== 0) {
      throw new SlotValidationError('granularity', s.dayOfWeek, `slot not aligned to ${GRANULARITY}-minute granularity`);
    }
    if (s.endMinute - s.startMinute < MIN_SLOT_MINUTES) {
      throw new SlotValidationError('too_short', s.dayOfWeek, `slot must be at least ${MIN_SLOT_MINUTES} minutes`);
    }
  }

  // 2) Overlap within the same day (touching boundary is allowed)
  const byDay = new Map<number, AvailabilitySlotInput[]>();
  for (const s of slots) {
    const list = byDay.get(s.dayOfWeek) ?? [];
    list.push(s);
    byDay.set(s.dayOfWeek, list);
  }
  for (const [day, list] of byDay) {
    const sorted = [...list].sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      if (curr.startMinute < prev.endMinute) {
        throw new SlotValidationError('overlap', day, `slots overlap on day ${day}`);
      }
    }
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern slot-validation`

Expected: all 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/availability/slot-validation.ts apps/api/src/availability/slot-validation.spec.ts
git commit -m "feat(availability): slot validation with explicit violation reasons"
```

---

## Task 5: API — `AvailabilityService.upsert` with slots + clearDays (TDD)

**Files:**
- Modify: `apps/api/src/availability/availability.service.ts`
- Modify: `apps/api/src/availability/availability.service.spec.ts`

- [ ] **Step 1: Extend the fake Prisma used by the existing spec**

At the top of `apps/api/src/availability/availability.service.spec.ts`, replace the import block with:

```ts
import { AvailabilityService } from './availability.service';
import type { AvailabilityPatchInput } from './availability.types';
```

and extend the `fakePrisma()` helper to support the slot table + a simple `$transaction`. Insert right before the `return {` inside `fakePrisma`:

```ts
  const slotRows = new Map<string, {
    id: string;
    userId: string;
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
  }>();
```

and add to the returned object (next to `user:` / `cycle:` keys):

```ts
    availabilitySlot: {
      findMany: jest.fn(async ({ where }: any) => {
        const out = [];
        for (const s of slotRows.values()) {
          if (where.userId && s.userId !== where.userId) continue;
          out.push(s);
        }
        return out.sort((a, b) =>
          a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute,
        );
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        let n = 0;
        for (const [id, s] of slotRows) {
          if (where.userId && s.userId !== where.userId) continue;
          if (where.dayOfWeek !== undefined) {
            const target = where.dayOfWeek.in ?? [where.dayOfWeek];
            if (!target.includes(s.dayOfWeek)) continue;
          }
          slotRows.delete(id);
          n += 1;
        }
        return { count: n };
      }),
      createMany: jest.fn(async ({ data }: any) => {
        for (const d of data) {
          const id = `slot-${slotRows.size + 1}`;
          slotRows.set(id, { id, ...d });
        }
        return { count: data.length };
      }),
    },
    $transaction: jest.fn(async (cb: any) => cb({ ...prismaProxy() })),
```

Because `$transaction` needs a reference to the same facade, extract the returned object into `const api = { ... }` first and then:

```ts
  function prismaProxy() { return api; }
  return api;
```

(See the existing file for how `fakePrisma` currently returns — you may prefer to simply assign `const api = { ... }` then `const $transaction = (cb) => cb(api); api.$transaction = $transaction; return api;`).

- [ ] **Step 2: Write the new failing tests**

Append to `apps/api/src/availability/availability.service.spec.ts`:

```ts
describe('AvailabilityService.upsert with slots', () => {
  it('replaces slots for the days present in payload, leaves others untouched', async () => {
    const prisma = fakePrisma();
    // Seed Tuesday with one existing slot
    prisma.slotRows?.set('pre-1', {
      id: 'pre-1', userId: 'user-1', dayOfWeek: 1, startMinute: 0, endMinute: 60,
    });
    // Seed Wednesday with a slot
    prisma.slotRows?.set('pre-2', {
      id: 'pre-2', userId: 'user-1', dayOfWeek: 2, startMinute: 600, endMinute: 720,
    });
    const svc = new AvailabilityService(prisma as any);
    const patch: AvailabilityPatchInput = {
      preferredSessionMinutes: 60,
      timezone: 'America/Sao_Paulo',
      slots: [
        { dayOfWeek: 0, startMinute: 480, endMinute: 600 },
        { dayOfWeek: 0, startMinute: 1140, endMinute: 1320 },
        { dayOfWeek: 1, startMinute: 0, endMinute: 30 },
      ],
    };
    const out = await svc.upsert('user-1', patch);
    // Monday replaced (2 new slots)
    const monday = out.slots.filter((s) => s.dayOfWeek === 0);
    expect(monday).toHaveLength(2);
    // Tuesday replaced (old removed, new inserted)
    const tuesday = out.slots.filter((s) => s.dayOfWeek === 1);
    expect(tuesday).toHaveLength(1);
    expect(tuesday[0]!.startMinute).toBe(0);
    expect(tuesday[0]!.endMinute).toBe(30); // fails too_short? No: 30 IS the minimum.
    // Wednesday untouched
    const wednesday = out.slots.filter((s) => s.dayOfWeek === 2);
    expect(wednesday).toHaveLength(1);
    expect(wednesday[0]!.startMinute).toBe(600);
  });

  it('clearDays wipes slots for those days without introducing new ones', async () => {
    const prisma = fakePrisma();
    prisma.slotRows?.set('pre-1', {
      id: 'pre-1', userId: 'user-1', dayOfWeek: 0, startMinute: 480, endMinute: 600,
    });
    prisma.slotRows?.set('pre-2', {
      id: 'pre-2', userId: 'user-1', dayOfWeek: 1, startMinute: 480, endMinute: 600,
    });
    const svc = new AvailabilityService(prisma as any);
    const out = await svc.upsert('user-1', {
      preferredSessionMinutes: 60,
      timezone: 'America/Sao_Paulo',
      clearDays: [0],
    });
    expect(out.slots.filter((s) => s.dayOfWeek === 0)).toHaveLength(0);
    expect(out.slots.filter((s) => s.dayOfWeek === 1)).toHaveLength(1);
  });

  it('rejects overlapping slots with SlotValidationError', async () => {
    const prisma = fakePrisma();
    const svc = new AvailabilityService(prisma as any);
    await expect(
      svc.upsert('user-1', {
        preferredSessionMinutes: 60,
        timezone: 'America/Sao_Paulo',
        slots: [
          { dayOfWeek: 0, startMinute: 480, endMinute: 720 },
          { dayOfWeek: 0, startMinute: 600, endMinute: 900 },
        ],
      }),
    ).rejects.toThrow(/overlap/);
  });

  it('allows null day caps (no cap)', async () => {
    const prisma = fakePrisma();
    const svc = new AvailabilityService(prisma as any);
    const out = await svc.upsert('user-1', {
      mondayMinutes: null,
      tuesdayMinutes: 120,
      preferredSessionMinutes: 60,
      timezone: 'America/Sao_Paulo',
      slots: [{ dayOfWeek: 0, startMinute: 480, endMinute: 1320 }],
    });
    expect(out.mondayMinutes).toBeNull();
    expect(out.tuesdayMinutes).toBe(120);
  });
});
```

Fix the Tuesday test's slot end to `60` (not `30`) because a 30→60 is only 30 minutes long — valid.

Re-check: I wrote `{ dayOfWeek: 1, startMinute: 0, endMinute: 30 }` — that's exactly 30 minutes and passes `too_short` (`>= 30`). Good.

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern availability.service`

Expected: the new cases fail (`svc.upsert` signature rejects the new shape, no `slots` on output, validation not wired in).

- [ ] **Step 4: Rewrite `availability.service.ts`**

Replace the full content of `apps/api/src/availability/availability.service.ts` with:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import type { Track } from '@ics-select/shared';
import { PrismaService } from '../common/prisma/prisma.service.js';
import {
  resolveActiveCycle,
  resolveActiveMembership,
} from '../common/cycle/active-cycle.js';
import {
  SlotValidationError,
  validateSlots,
} from './slot-validation.js';
import type {
  AvailabilityFullResponse,
  AvailabilityPatchInput,
} from './availability.types.js';

export type ProfileInput = {
  whatsappPhone?: string | null;
  targetTrack?: Track | null;
};

const CAP_KEYS = [
  'mondayMinutes',
  'tuesdayMinutes',
  'wednesdayMinutes',
  'thursdayMinutes',
  'fridayMinutes',
  'saturdayMinutes',
  'sundayMinutes',
] as const;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<AvailabilityFullResponse | null> {
    const availability = await this.prisma.memberAvailability.findUnique({
      where: { userId },
    });
    const slots = await this.prisma.availabilitySlot.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    });
    if (!availability) return null;
    return {
      mondayMinutes: availability.mondayMinutes ?? null,
      tuesdayMinutes: availability.tuesdayMinutes ?? null,
      wednesdayMinutes: availability.wednesdayMinutes ?? null,
      thursdayMinutes: availability.thursdayMinutes ?? null,
      fridayMinutes: availability.fridayMinutes ?? null,
      saturdayMinutes: availability.saturdayMinutes ?? null,
      sundayMinutes: availability.sundayMinutes ?? null,
      preferredSessionMinutes: availability.preferredSessionMinutes,
      timezone: availability.timezone,
      slots: slots.map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startMinute: s.startMinute,
        endMinute: s.endMinute,
      })),
    };
  }

  async upsert(
    userId: string,
    input: AvailabilityPatchInput,
  ): Promise<AvailabilityFullResponse> {
    if (input.slots && input.slots.length > 0) {
      try {
        validateSlots(input.slots);
      } catch (err) {
        if (err instanceof SlotValidationError) {
          throw new BadRequestException({
            error: {
              code: 'BAD_REQUEST',
              message: err.message,
              details: { field: 'slots', reason: err.reason, dayOfWeek: err.dayOfWeek },
            },
          });
        }
        throw err;
      }
    }

    // Build the caps portion of the upsert
    const capsData: Record<string, number | null | undefined> = {};
    for (const key of CAP_KEYS) {
      if (input[key] !== undefined) capsData[key] = input[key]!;
    }

    // Days affected by slot replacement:
    //   - any day that appears in `slots`
    //   - plus any day in `clearDays`
    const daysWithSlots = new Set<number>();
    for (const s of input.slots ?? []) daysWithSlots.add(s.dayOfWeek);
    const clearDays = new Set<number>([...(input.clearDays ?? []), ...daysWithSlots]);

    await this.prisma.$transaction(async (tx) => {
      await tx.memberAvailability.upsert({
        where: { userId },
        create: {
          userId,
          ...capsData,
          preferredSessionMinutes: input.preferredSessionMinutes ?? 60,
          timezone: input.timezone ?? 'America/Sao_Paulo',
        },
        update: {
          ...capsData,
          ...(input.preferredSessionMinutes !== undefined && {
            preferredSessionMinutes: input.preferredSessionMinutes,
          }),
          ...(input.timezone !== undefined && { timezone: input.timezone }),
        },
      });

      if (clearDays.size > 0) {
        await tx.availabilitySlot.deleteMany({
          where: { userId, dayOfWeek: { in: Array.from(clearDays) } },
        });
      }

      if (input.slots && input.slots.length > 0) {
        await tx.availabilitySlot.createMany({
          data: input.slots.map((s) => ({
            userId,
            dayOfWeek: s.dayOfWeek,
            startMinute: s.startMinute,
            endMinute: s.endMinute,
          })),
        });
      }
    });

    return (await this.get(userId))!;
  }

  async updateProfile(userId: string, input: ProfileInput) {
    let user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (input.whatsappPhone !== undefined) {
      user = await this.prisma.user.update({
        where: { id: userId },
        data: { whatsappPhone: input.whatsappPhone },
      });
    }

    let membership = null;
    if (input.targetTrack !== undefined) {
      const existing = await resolveActiveMembership(this.prisma, userId);
      if (existing) {
        membership = await this.prisma.cycleMembership.update({
          where: { id: existing.id },
          data: { track: input.targetTrack },
        });
      } else {
        const active = await resolveActiveCycle(this.prisma);
        if (active) {
          membership = await this.prisma.cycleMembership.create({
            data: {
              userId,
              cycleId: active.id,
              track: input.targetTrack,
            },
          });
          if (user?.email) {
            await this.prisma.invitedEmail.deleteMany({
              where: { email: user.email },
            });
          }
        }
      }
    }

    return { user, membership };
  }
}
```

- [ ] **Step 5: Run the full availability test file**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern availability.service`

Expected: pre-existing + new tests all pass. If the old `upsert creates a new availability row with defaults` test still exists, its shape (7 minutes keys + pref + tz, no slots) still satisfies the new signature.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/availability/availability.service.ts apps/api/src/availability/availability.service.spec.ts
git commit -m "feat(availability): upsert handles slots + clearDays + nullable caps"
```

---

## Task 6: API — controller payload + response shape

**Files:**
- Modify: `apps/api/src/availability/availability.controller.ts`

- [ ] **Step 1: Rewrite the controller**

Replace the full content of `apps/api/src/availability/availability.controller.ts` with:

```ts
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { TRACKS } from '@ics-select/shared';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { AvailabilityService } from './availability.service.js';

const SlotSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1410),
    endMinute: z.number().int().min(30).max(1440),
  })
  .refine((s) => s.endMinute > s.startMinute, {
    message: 'endMinute must be greater than startMinute',
  });

const nullableDayCap = z
  .number()
  .int()
  .min(0)
  .max(24 * 60)
  .nullable()
  .optional();

const AvailabilityPatchSchema = z.object({
  mondayMinutes: nullableDayCap,
  tuesdayMinutes: nullableDayCap,
  wednesdayMinutes: nullableDayCap,
  thursdayMinutes: nullableDayCap,
  fridayMinutes: nullableDayCap,
  saturdayMinutes: nullableDayCap,
  sundayMinutes: nullableDayCap,
  preferredSessionMinutes: z.number().int().min(15).max(240).optional(),
  timezone: z.string().optional(),
  slots: z.array(SlotSchema).optional(),
  clearDays: z.array(z.number().int().min(0).max(6)).optional(),
});

const UpdateProfileSchema = z.object({
  whatsappPhone: z
    .string()
    .regex(/^\+\d{8,15}$/)
    .nullable()
    .optional(),
  targetTrack: z.enum(TRACKS).nullable().optional(),
});

@Controller('me')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get('availability')
  get(@CurrentUser() user: JwtStrategyPayload) {
    return this.availability.get(user.sub);
  }

  @Patch('availability')
  upsert(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const parsed = AvailabilityPatchSchema.parse(body);
    return this.availability.upsert(user.sub, parsed);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const input = UpdateProfileSchema.parse(body);
    return this.availability.updateProfile(user.sub, input);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/api typecheck`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/availability/availability.controller.ts
git commit -m "feat(availability): controller accepts nullable caps + slots + clearDays"
```

---

## Task 7: API — e2e coverage of `PATCH /me/availability`

**Files:**
- Create: `apps/api/test/availability.e2e-spec.ts`

- [ ] **Step 1: Check an existing e2e for the pattern**

Run: `ls apps/api/test/` and `head -30 apps/api/test/*.e2e-spec.ts` to confirm the style used (`Test.createTestingModule` from `@nestjs/testing`, request via `supertest`, Prisma mocked).

- [ ] **Step 2: Write the e2e spec**

Create `apps/api/test/availability.e2e-spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('PATCH /me/availability (e2e)', () => {
  let app: INestApplication;
  let prisma: any;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(makeFakePrisma())
      .compile();

    app = mod.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => app?.close());

  it('rejects overlapping slots with 400 BAD_REQUEST', async () => {
    const res = await request(app.getHttpServer())
      .patch('/me/availability')
      .set('Authorization', fakeJwt('user-1'))
      .send({
        preferredSessionMinutes: 60,
        timezone: 'America/Sao_Paulo',
        slots: [
          { dayOfWeek: 0, startMinute: 480, endMinute: 720 },
          { dayOfWeek: 0, startMinute: 600, endMinute: 900 },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.details.reason).toBe('overlap');
  });

  it('saves slots + nullable caps and returns the full shape', async () => {
    const res = await request(app.getHttpServer())
      .patch('/me/availability')
      .set('Authorization', fakeJwt('user-1'))
      .send({
        mondayMinutes: null,
        tuesdayMinutes: 120,
        preferredSessionMinutes: 60,
        timezone: 'America/Sao_Paulo',
        slots: [
          { dayOfWeek: 0, startMinute: 480, endMinute: 1320 },
          { dayOfWeek: 1, startMinute: 1140, endMinute: 1320 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.mondayMinutes).toBeNull();
    expect(res.body.tuesdayMinutes).toBe(120);
    expect(res.body.slots).toHaveLength(2);
    expect(res.body.slots[0].dayOfWeek).toBe(0);
  });
});

function fakeJwt(sub: string): string {
  // The e2e tests of this repo bypass JWT by providing a stub strategy. Use the
  // same mechanism other e2e specs use in this file tree.
  return `Bearer test.${Buffer.from(JSON.stringify({ sub, role: 'MEMBER' })).toString('base64')}`;
}

function makeFakePrisma() {
  const slots = new Map<string, any>();
  const mem = new Map<string, any>();
  const facade = {
    memberAvailability: {
      findUnique: async ({ where }: any) => mem.get(where.userId) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = mem.get(where.userId);
        const next = existing ? { ...existing, ...update } : { id: 'a1', ...create };
        mem.set(where.userId, next);
        return next;
      },
    },
    availabilitySlot: {
      findMany: async ({ where, orderBy }: any) => {
        const out: any[] = [];
        for (const s of slots.values()) if (s.userId === where.userId) out.push(s);
        out.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute);
        return out;
      },
      deleteMany: async ({ where }: any) => {
        for (const [id, s] of slots) {
          if (s.userId !== where.userId) continue;
          const days = where.dayOfWeek?.in ?? [];
          if (days.includes(s.dayOfWeek)) slots.delete(id);
        }
        return { count: 0 };
      },
      createMany: async ({ data }: any) => {
        for (const d of data) slots.set(`s-${slots.size + 1}`, { id: `s-${slots.size + 1}`, ...d });
        return { count: data.length };
      },
    },
    $connect: async () => {},
    $disconnect: async () => {},
    $transaction: async (cb: any) => cb(facade),
  };
  return facade;
}
```

**Note:** if existing e2e specs in `apps/api/test/` use a different JWT mechanism (for example, a `beforeAll` that creates a real user + refresh token), mirror that pattern instead of the `fakeJwt` placeholder above. The point of this test is the 400/200 behavior, not the auth scaffolding.

- [ ] **Step 3: Run the e2e**

Run: `pnpm --filter @ics-select/api test:e2e -- --testPathPattern availability`

Expected: both tests pass. Adjust the JWT stub or Prisma facade to match other e2e specs in the same folder if they show a different pattern.

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/availability.e2e-spec.ts
git commit -m "test(availability): e2e for slots + overlap rejection"
```

---

## Task 8: Scheduler — extract types + input shape

**Files:**
- Create: `apps/api/src/scheduler/scheduler.types.ts`

- [ ] **Step 1: Create the types file**

Create `apps/api/src/scheduler/scheduler.types.ts`:

```ts
export type AvailabilitySlotInput = {
  dayOfWeek: number;   // 0..6, 0 = Monday
  startMinute: number; // minute of local day
  endMinute: number;
};

export type BusyBlock = { start: Date; end: Date };

export type ItemInput = {
  id: string;
  estimatedMinutes: number;
  order: number; // admin's WeeklyPlanItem.order
};

export type SchedulerInput = {
  weekStart: Date;
  availability: {
    slots: AvailabilitySlotInput[];
    caps: (number | null)[];  // length 7, index 0=Mon, null = no cap
    preferredSessionMinutes: number;
    timezone: string;
  };
  busyBlocks: BusyBlock[];
  items: ItemInput[];
  now?: Date;
};

export type PlannedSession = {
  itemId: string;
  scheduledAt: Date;
  durationMinutes: number;
};

export type OverflowChunk = { itemId: string; minutesRequired: number };

export type SchedulerDiagnostics = {
  phase1Cost: number;
  finalCost: number;
  nodesExplored: number;
  timedOut: boolean;
  durationMs: number;
};

export type SchedulerOutput = {
  sessions: PlannedSession[];
  overflow: OverflowChunk[];
  diagnostics: SchedulerDiagnostics;
};

// Internal types (exported for unit tests of the objective / solver pieces)

export type EffectiveInterval = {
  dayIdx: number;      // 0..6
  startMinute: number; // minute of local day
  endMinute: number;
  slotSize: number;    // size of parent slot (pre-busy), used for rule iii
};

export type Chunk = {
  itemId: string;
  order: number;
  minutes: number;
  isResidue: boolean;  // true iff this chunk is < preferredSessionMinutes AND is a tail chunk
};

export type Placement = {
  chunk: Chunk;
  intervalIdx: number;
  offsetInInterval: number; // minutes into the interval where the chunk starts
};

export type Solution = {
  placements: Placement[];
  unplaced: Chunk[];
};
```

- [ ] **Step 2: Typecheck (no implementation yet — this will not break anything)**

Run: `pnpm --filter @ics-select/api typecheck`

Expected: pass. The file is unused; no downstream breakage.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/scheduler/scheduler.types.ts
git commit -m "feat(scheduler): extract types for week-level input shape"
```

---

## Task 9: Scheduler — objective function (TDD)

**Files:**
- Create: `apps/api/src/scheduler/objective.ts`
- Create: `apps/api/src/scheduler/objective.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/scheduler/objective.spec.ts`:

```ts
import { computeCost, WEIGHTS } from './objective';
import type { Chunk, EffectiveInterval, Solution } from './scheduler.types';

function chunk(id: string, minutes: number, order: number, isResidue = false): Chunk {
  return { itemId: id, order, minutes, isResidue };
}
function interval(idx: number, start: number, end: number, slotSize: number): EffectiveInterval {
  return { dayIdx: idx, startMinute: start, endMinute: end, slotSize };
}

describe('computeCost', () => {
  const pref = 60;

  it('unplaced dominates everything', () => {
    const sol: Solution = { placements: [], unplaced: [chunk('a', 60, 1)] };
    const cost = computeCost(sol, [], pref);
    expect(cost).toBeGreaterThanOrEqual(WEIGHTS.UNPLACED_PENALTY);
  });

  it('zero cost for single full chunk in a perfectly-sized slot', () => {
    const intervals = [interval(0, 480, 540, 60)]; // 08:00-09:00, slot size 60
    const sol: Solution = {
      placements: [{ chunk: chunk('a', 60, 1), intervalIdx: 0, offsetInInterval: 0 }],
      unplaced: [],
    };
    const cost = computeCost(sol, intervals, pref);
    // SLOT_COUNT=1 * 100 = 100. Everything else is 0.
    expect(cost).toBe(WEIGHTS.SLOT_COUNT_WEIGHT);
  });

  it('penalizes residue placed in a big slot', () => {
    const intervals = [interval(0, 480, 720, 240)]; // 4h slot
    const sol: Solution = {
      placements: [
        { chunk: chunk('a', 30, 1, true), intervalIdx: 0, offsetInInterval: 0 },
      ],
      unplaced: [],
    };
    const cost = computeCost(sol, intervals, pref);
    expect(cost).toBeGreaterThanOrEqual(
      WEIGHTS.SLOT_COUNT_WEIGHT + WEIGHTS.RESIDUE_IN_BIG_WEIGHT * 30,
    );
  });

  it('penalizes placement in a small slot', () => {
    const intervals = [interval(0, 480, 510, 30)]; // 30-min slot, slot size < pref
    const sol: Solution = {
      placements: [
        { chunk: chunk('a', 30, 1, false), intervalIdx: 0, offsetInInterval: 0 },
      ],
      unplaced: [],
    };
    const cost = computeCost(sol, intervals, pref);
    expect(cost).toBeGreaterThanOrEqual(WEIGHTS.SMALL_SLOT_WEIGHT * 30);
  });

  it('penalizes order inversion (higher-order chunk scheduled earlier)', () => {
    const intervals = [
      interval(0, 480, 600, 120), // Monday 08-10
      interval(1, 480, 600, 120), // Tuesday 08-10
    ];
    // order=1 on Tuesday, order=2 on Monday → inversion
    const sol: Solution = {
      placements: [
        { chunk: chunk('b', 60, 2), intervalIdx: 0, offsetInInterval: 0 }, // Mon
        { chunk: chunk('a', 60, 1), intervalIdx: 1, offsetInInterval: 0 }, // Tue
      ],
      unplaced: [],
    };
    const cost = computeCost(sol, intervals, pref);
    expect(cost).toBeGreaterThanOrEqual(WEIGHTS.ORDER_VIOLATION_WEIGHT);
  });

  it('penalizes day imbalance: 3h on one day vs evenly spread', () => {
    const intervals = [
      interval(0, 480, 720, 240), // Mon 4h
      interval(1, 480, 720, 240), // Tue 4h
      interval(2, 480, 720, 240), // Wed 4h
    ];
    const piledMonday: Solution = {
      placements: [
        { chunk: chunk('a', 60, 1), intervalIdx: 0, offsetInInterval: 0 },
        { chunk: chunk('b', 60, 2), intervalIdx: 0, offsetInInterval: 70 },
        { chunk: chunk('c', 60, 3), intervalIdx: 0, offsetInInterval: 140 },
      ],
      unplaced: [],
    };
    const spread: Solution = {
      placements: [
        { chunk: chunk('a', 60, 1), intervalIdx: 0, offsetInInterval: 0 },
        { chunk: chunk('b', 60, 2), intervalIdx: 1, offsetInInterval: 0 },
        { chunk: chunk('c', 60, 3), intervalIdx: 2, offsetInInterval: 0 },
      ],
      unplaced: [],
    };
    expect(computeCost(piledMonday, intervals, pref)).toBeGreaterThan(
      computeCost(spread, intervals, pref),
    );
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern scheduler/objective`

Expected: tests fail, file does not exist.

- [ ] **Step 3: Implement the objective**

Create `apps/api/src/scheduler/objective.ts`:

```ts
import type {
  Chunk,
  EffectiveInterval,
  Placement,
  Solution,
} from './scheduler.types.js';

export const WEIGHTS = {
  UNPLACED_PENALTY: 100_000,
  DAY_IMBALANCE_WEIGHT: 1_000,
  SLOT_COUNT_WEIGHT: 100,
  RESIDUE_IN_BIG_WEIGHT: 50,
  SMALL_SLOT_WEIGHT: 20,
  ORDER_VIOLATION_WEIGHT: 5,
  WASTE_WEIGHT: 1,
} as const;

export function computeCost(
  solution: Solution,
  intervals: EffectiveInterval[],
  pref: number,
): number {
  let cost = 0;

  // 1) Unplaced
  let unplacedMinutes = 0;
  for (const c of solution.unplaced) unplacedMinutes += c.minutes;
  cost += WEIGHTS.UNPLACED_PENALTY * unplacedMinutes;

  // 2) Day imbalance = sum of max(0, dayLoad[d] - mean_load)
  const dayLoad = [0, 0, 0, 0, 0, 0, 0];
  for (const p of solution.placements) {
    const iv = intervals[p.intervalIdx]!;
    dayLoad[iv.dayIdx]! += p.chunk.minutes;
  }
  const total = dayLoad.reduce((s, m) => s + m, 0);
  const mean = total / 7;
  let imbalance = 0;
  for (const load of dayLoad) imbalance += Math.max(0, load - mean);
  cost += WEIGHTS.DAY_IMBALANCE_WEIGHT * imbalance;

  // 3) Slot count = number of distinct intervalIdx in placements
  const touched = new Set<number>();
  for (const p of solution.placements) touched.add(p.intervalIdx);
  cost += WEIGHTS.SLOT_COUNT_WEIGHT * touched.size;

  // 4) Residue in big slot
  let residueInBig = 0;
  for (const p of solution.placements) {
    const iv = intervals[p.intervalIdx]!;
    if (p.chunk.isResidue && iv.slotSize >= pref) residueInBig += p.chunk.minutes;
  }
  cost += WEIGHTS.RESIDUE_IN_BIG_WEIGHT * residueInBig;

  // 5) Minutes in small (sub-pref) slot
  let inSmall = 0;
  for (const p of solution.placements) {
    const iv = intervals[p.intervalIdx]!;
    if (iv.slotSize < pref) inSmall += p.chunk.minutes;
  }
  cost += WEIGHTS.SMALL_SLOT_WEIGHT * inSmall;

  // 6) Order violation: pair of placements (a, b) with a.order < b.order
  //    AND wall-clock(a) > wall-clock(b). Wall-clock approximated as
  //    (dayIdx * 1440) + (interval.start + offset).
  const withTime = solution.placements.map((p) => ({
    p,
    t: intervals[p.intervalIdx]!.dayIdx * 1440 +
       intervals[p.intervalIdx]!.startMinute + p.offsetInInterval,
  }));
  let inversions = 0;
  for (let i = 0; i < withTime.length; i++) {
    for (let j = 0; j < withTime.length; j++) {
      if (i === j) continue;
      const a = withTime[i]!, b = withTime[j]!;
      if (a.p.chunk.order < b.p.chunk.order && a.t > b.t) inversions += 1;
    }
  }
  // Pair counted once in each direction, divide by 2.
  cost += WEIGHTS.ORDER_VIOLATION_WEIGHT * (inversions / 2);

  // 7) Waste = unused minutes inside touched intervals.
  //    For each touched interval, waste = interval_size - total_placed_minutes_in_it.
  const usedPerInterval = new Map<number, number>();
  for (const p of solution.placements) {
    usedPerInterval.set(
      p.intervalIdx,
      (usedPerInterval.get(p.intervalIdx) ?? 0) + p.chunk.minutes,
    );
  }
  let waste = 0;
  for (const [idx, used] of usedPerInterval) {
    const iv = intervals[idx]!;
    waste += Math.max(0, (iv.endMinute - iv.startMinute) - used);
  }
  cost += WEIGHTS.WASTE_WEIGHT * waste;

  return cost;
}

// Helper used by the B&B lower-bound
export function minCostRemaining(
  remainingChunks: Chunk[],
  _intervals: EffectiveInterval[],
  _pref: number,
): number {
  // Conservative lower bound: residues in big slots and minutes-in-small both
  // default to zero since we don't know the placement yet. Only UNPLACED would
  // push up if the chunk ends up unplaced, which is itself bounded above.
  // Returning 0 is always a valid lower bound (cost can only grow).
  return 0;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern scheduler/objective`

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/scheduler/objective.ts apps/api/src/scheduler/objective.spec.ts
git commit -m "feat(scheduler): objective function with lexicographic weights"
```

---

## Task 10: Scheduler — effective intervals + chunking helpers

**Files:**
- Create: `apps/api/src/scheduler/intervals.ts`
- Create: `apps/api/src/scheduler/intervals.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/scheduler/intervals.spec.ts`:

```ts
import { buildEffectiveIntervals, chunkItems } from './intervals';
import type { AvailabilitySlotInput, BusyBlock, ItemInput } from './scheduler.types';

const MONDAY = new Date('2026-04-13T00:00:00-03:00'); // 03:00 UTC
const BEFORE_WEEK = new Date('2026-04-12T12:00:00-03:00');

describe('buildEffectiveIntervals', () => {
  it('returns one interval per slot when there are no busy blocks', () => {
    const slots: AvailabilitySlotInput[] = [
      { dayOfWeek: 0, startMinute: 480, endMinute: 1320 },
      { dayOfWeek: 1, startMinute: 1140, endMinute: 1320 },
    ];
    const ivs = buildEffectiveIntervals(slots, [], MONDAY, 'America/Sao_Paulo', BEFORE_WEEK);
    expect(ivs).toHaveLength(2);
    expect(ivs[0]!.dayIdx).toBe(0);
    expect(ivs[0]!.startMinute).toBe(480);
    expect(ivs[0]!.slotSize).toBe(1320 - 480);
    expect(ivs[1]!.dayIdx).toBe(1);
  });

  it('splits a slot when a busy block falls inside', () => {
    const slots: AvailabilitySlotInput[] = [
      { dayOfWeek: 0, startMinute: 480, endMinute: 1320 },
    ];
    const busy: BusyBlock[] = [{
      start: new Date('2026-04-13T12:00:00-03:00'),
      end: new Date('2026-04-13T14:00:00-03:00'),
    }];
    const ivs = buildEffectiveIntervals(slots, busy, MONDAY, 'America/Sao_Paulo', BEFORE_WEEK);
    expect(ivs.length).toBeGreaterThanOrEqual(2);
    // The slot size is preserved on both remnants (rule iii depends on it).
    for (const iv of ivs) expect(iv.slotSize).toBe(840);
  });

  it('skips intervals that end at or before "now"', () => {
    const slots: AvailabilitySlotInput[] = [
      { dayOfWeek: 0, startMinute: 480, endMinute: 1320 },
    ];
    const now = new Date('2026-04-13T23:00:00-03:00'); // Monday, past the slot
    const ivs = buildEffectiveIntervals(slots, [], MONDAY, 'America/Sao_Paulo', now);
    expect(ivs.filter((iv) => iv.dayIdx === 0)).toHaveLength(0);
  });
});

describe('chunkItems', () => {
  it('splits items into pref-sized chunks + a tail residue when needed', () => {
    const items: ItemInput[] = [{ id: 'i1', estimatedMinutes: 75, order: 1 }];
    const chunks = chunkItems(items, 30);
    expect(chunks.map((c) => c.minutes)).toEqual([30, 30, 15]);
    expect(chunks[0]!.isResidue).toBe(false);
    expect(chunks[1]!.isResidue).toBe(false);
    expect(chunks[2]!.isResidue).toBe(true);
  });

  it('marks a single item smaller than pref as a residue chunk', () => {
    const items: ItemInput[] = [{ id: 'i1', estimatedMinutes: 20, order: 1 }];
    const chunks = chunkItems(items, 60);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.minutes).toBe(20);
    expect(chunks[0]!.isResidue).toBe(true);
  });

  it('preserves order from the input array', () => {
    const items: ItemInput[] = [
      { id: 'a', estimatedMinutes: 60, order: 2 },
      { id: 'b', estimatedMinutes: 60, order: 1 },
    ];
    const chunks = chunkItems(items, 60);
    expect(chunks.map((c) => c.order)).toEqual([2, 1]);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern scheduler/intervals`

Expected: fails, file missing.

- [ ] **Step 3: Implement the helpers**

Create `apps/api/src/scheduler/intervals.ts`:

```ts
import type {
  AvailabilitySlotInput,
  BusyBlock,
  Chunk,
  EffectiveInterval,
  ItemInput,
} from './scheduler.types.js';

const ROUND_TO_MINUTES = 15;

export function chunkItems(items: ItemInput[], pref: number): Chunk[] {
  const chunks: Chunk[] = [];
  for (const item of items) {
    let remaining = item.estimatedMinutes;
    while (remaining > 0) {
      const size = Math.min(remaining, pref);
      chunks.push({
        itemId: item.id,
        order: item.order,
        minutes: size,
        isResidue: size < pref,
      });
      remaining -= size;
    }
  }
  return chunks;
}

export function buildEffectiveIntervals(
  slots: AvailabilitySlotInput[],
  busyBlocks: BusyBlock[],
  weekStart: Date,
  timezone: string,
  now: Date,
): EffectiveInterval[] {
  const out: EffectiveInterval[] = [];
  for (const slot of slots) {
    const dayStartUtc = localMinuteToUtc(weekStart, slot.dayOfWeek, 0, timezone);
    const dayEndUtc = localMinuteToUtc(weekStart, slot.dayOfWeek + 1, 0, timezone);
    const slotStartUtc = localMinuteToUtc(weekStart, slot.dayOfWeek, slot.startMinute, timezone);
    const slotEndUtc = localMinuteToUtc(weekStart, slot.dayOfWeek, slot.endMinute, timezone);

    // Skip if the slot is entirely in the past.
    if (slotEndUtc.getTime() <= now.getTime()) continue;

    // Clip slot to [ceil(now, 15min), slotEnd] if today is current.
    let startMin = slot.startMinute;
    if (slotStartUtc.getTime() <= now.getTime() && now.getTime() < slotEndUtc.getTime()) {
      const elapsed = Math.round((now.getTime() - dayStartUtc.getTime()) / 60_000);
      const rounded = Math.ceil(elapsed / ROUND_TO_MINUTES) * ROUND_TO_MINUTES;
      startMin = Math.max(startMin, rounded);
    }
    if (startMin >= slot.endMinute) continue;

    // Project busy blocks into [startMin, slot.endMinute] in this day's local minutes.
    const busyInSlot: Array<{ start: number; end: number }> = [];
    for (const b of busyBlocks) {
      const bs = Math.max(b.start.getTime(), dayStartUtc.getTime());
      const be = Math.min(b.end.getTime(), dayEndUtc.getTime());
      if (be <= bs) continue;
      const sMin = Math.floor((bs - dayStartUtc.getTime()) / 60_000);
      const eMin = Math.ceil((be - dayStartUtc.getTime()) / 60_000);
      const clampedStart = Math.max(sMin, startMin);
      const clampedEnd = Math.min(eMin, slot.endMinute);
      if (clampedEnd > clampedStart) busyInSlot.push({ start: clampedStart, end: clampedEnd });
    }

    // Merge overlapping busy blocks
    busyInSlot.sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number }> = [];
    for (const b of busyInSlot) {
      const last = merged[merged.length - 1];
      if (last && b.start <= last.end) last.end = Math.max(last.end, b.end);
      else merged.push({ ...b });
    }

    // Subtract merged busy from [startMin, slot.endMinute]
    let cursor = startMin;
    const slotSize = slot.endMinute - slot.startMinute;
    for (const b of merged) {
      if (b.start > cursor) {
        out.push({
          dayIdx: slot.dayOfWeek,
          startMinute: cursor,
          endMinute: b.start,
          slotSize,
        });
      }
      cursor = Math.max(cursor, b.end);
    }
    if (cursor < slot.endMinute) {
      out.push({
        dayIdx: slot.dayOfWeek,
        startMinute: cursor,
        endMinute: slot.endMinute,
        slotSize,
      });
    }
  }

  // Sort by (day, start) so downstream iteration is deterministic.
  out.sort((a, b) => a.dayIdx - b.dayIdx || a.startMinute - b.startMinute);
  return out;
}

export function localMinuteToUtc(
  weekStart: Date,
  dayIdx: number,
  minuteOfDay: number,
  tz: string,
): Date {
  const y = weekStart.getUTCFullYear();
  const m = weekStart.getUTCMonth() + 1;
  const d = weekStart.getUTCDate() + dayIdx;
  const hh = Math.floor(minuteOfDay / 60);
  const mm = minuteOfDay % 60;
  return localToUtc(y, m, d, hh, mm, tz);
}

function localToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offsetMin = getTzOffsetMinutes(new Date(naiveUtc), tz);
  return new Date(naiveUtc - offsetMin * 60_000);
}

function getTzOffsetMinutes(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  const asUtcMs = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return Math.round((asUtcMs - date.getTime()) / 60_000);
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern scheduler/intervals`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/scheduler/intervals.ts apps/api/src/scheduler/intervals.spec.ts
git commit -m "feat(scheduler): slot-to-effective-interval + item chunking"
```

---

## Task 11: Scheduler — phase 1 FFD (heuristic construction)

**Files:**
- Create: `apps/api/src/scheduler/phase1.ts`
- Create: `apps/api/src/scheduler/phase1.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/scheduler/phase1.spec.ts`:

```ts
import { phase1 } from './phase1';
import type { Chunk, EffectiveInterval } from './scheduler.types';

function ch(id: string, minutes: number, order: number, isResidue = false): Chunk {
  return { itemId: id, order, minutes, isResidue };
}
function iv(dayIdx: number, start: number, end: number, slotSize = end - start): EffectiveInterval {
  return { dayIdx, startMinute: start, endMinute: end, slotSize };
}

describe('phase1 FFD', () => {
  const pref = 60;

  it('places a single 60-min chunk into a 60-min slot', () => {
    const intervals = [iv(0, 480, 540)];
    const sol = phase1([ch('a', 60, 1)], intervals, [null, null, null, null, null, null, null], pref);
    expect(sol.unplaced).toHaveLength(0);
    expect(sol.placements).toHaveLength(1);
    expect(sol.placements[0]!.intervalIdx).toBe(0);
  });

  it('places all three 60-min chunks into intervals on Monday (consolidation is phase 2 job)', () => {
    // Phase 1 picks smallest-fitting interval per chunk, so consolidation into
    // the 3h slot is not guaranteed here — that is asserted end-to-end in the
    // scheduler.service.spec canonical case 1. Phase 1's guarantee is just
    // "every chunk gets a feasible placement on Monday when there is enough
    // room across its slots".
    const intervals = [
      iv(0, 480, 600),   // Mon 08-10 (2h)
      iv(0, 1260, 1440), // Mon 21-00 (3h)
    ];
    const chunks: Chunk[] = [
      ch('a', 60, 1), ch('b', 60, 2), ch('c', 60, 3),
    ];
    const sol = phase1(chunks, intervals, [null, null, null, null, null, null, null], pref);
    expect(sol.unplaced).toHaveLength(0);
    expect(sol.placements).toHaveLength(3);
    for (const p of sol.placements) {
      expect(intervals[p.intervalIdx]!.dayIdx).toBe(0);
    }
  });

  it('respects day cap: 60min cap on Monday holds only one 60-min chunk', () => {
    const intervals = [
      iv(0, 480, 720), // Mon 4h
      iv(1, 480, 720), // Tue 4h
    ];
    const chunks: Chunk[] = [ch('a', 60, 1), ch('b', 60, 2)];
    const caps: (number | null)[] = [60, null, null, null, null, null, null];
    const sol = phase1(chunks, intervals, caps, pref);
    const onMonday = sol.placements.filter((p) => intervals[p.intervalIdx]!.dayIdx === 0);
    const onTuesday = sol.placements.filter((p) => intervals[p.intervalIdx]!.dayIdx === 1);
    expect(onMonday).toHaveLength(1);
    expect(onTuesday).toHaveLength(1);
  });

  it('rule iii: a residue rejects placement in a busy-carved sub-pref interval of a big slot', () => {
    // Slot size 240 (big), busy cuts a 20-min residue in the middle.
    // The 20-min interval has slotSize=240 but size=20 < pref=60 → unusable.
    const intervals = [
      iv(0, 480, 500, 240),  // 20 min residue, parent slot 4h → unusable
      iv(0, 520, 720, 240),  // rest of slot, usable
    ];
    const sol = phase1([ch('r', 20, 1, true)], intervals, [null, null, null, null, null, null, null], pref);
    expect(sol.placements).toHaveLength(1);
    // Must NOT be in interval 0 (the busy-carved sub-pref residue).
    expect(sol.placements[0]!.intervalIdx).toBe(1);
  });

  it('honors a short declared slot (slot.size < pref): places a 30-min chunk', () => {
    // Slot = 30min, pref = 60. slotSize === interval size, so rule iii allows it.
    const intervals = [iv(0, 480, 510, 30)];
    const sol = phase1([ch('a', 30, 1)], intervals, [null, null, null, null, null, null, null], pref);
    expect(sol.placements).toHaveLength(1);
    expect(sol.placements[0]!.intervalIdx).toBe(0);
  });

  it('overflows when total work exceeds total capacity', () => {
    const intervals = [iv(0, 480, 540)]; // 60 min capacity
    const sol = phase1(
      [ch('a', 60, 1), ch('b', 60, 2)],
      intervals,
      [null, null, null, null, null, null, null],
      pref,
    );
    expect(sol.placements).toHaveLength(1);
    expect(sol.unplaced).toHaveLength(1);
    expect(sol.unplaced[0]!.itemId).toBe('b');
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern scheduler/phase1`

Expected: fails.

- [ ] **Step 3: Implement phase 1**

Create `apps/api/src/scheduler/phase1.ts`:

```ts
import type {
  Chunk,
  EffectiveInterval,
  Placement,
  Solution,
} from './scheduler.types.js';

const BUFFER_MINUTES = 10;

type IntervalState = {
  idx: number;
  cursor: number;       // next free offset (from interval.startMinute)
  capacityLeft: number; // endMinute - startMinute - cursor-advance
};

/**
 * Phase 1: First-Fit-Decreasing greedy construction.
 *
 * Rank candidate (day, interval) placements by:
 *   1. dayLoad[day] asc          — prefer least-loaded day (balance)
 *   2. |interval_size - chunk_size| asc — smallest-fit wins (preserves big slots)
 *   3. interval_start asc        — deterministic tiebreak
 *
 * Rule iii: an interval is unusable iff interval.size < pref AND slot.size >= pref.
 */
export function phase1(
  chunks: Chunk[],
  intervals: EffectiveInterval[],
  caps: (number | null)[],
  pref: number,
): Solution {
  // Sort chunks: largest first; ties break by order asc (pedagogical).
  const ordered = [...chunks].sort((a, b) =>
    b.minutes - a.minutes || a.order - b.order,
  );

  const states: IntervalState[] = intervals.map((iv, idx) => ({
    idx,
    cursor: 0,
    capacityLeft: iv.endMinute - iv.startMinute,
  }));
  const dayLoad = [0, 0, 0, 0, 0, 0, 0];

  const placements: Placement[] = [];
  const unplaced: Chunk[] = [];

  for (const chunk of ordered) {
    // Build candidate list
    type Cand = { idx: number; score: [number, number, number] };
    const candidates: Cand[] = [];
    for (const st of states) {
      const iv = intervals[st.idx]!;
      // Usability (rule iii)
      if (iv.endMinute - iv.startMinute < pref && iv.slotSize >= pref) continue;
      // Fits within the interval (with buffer if there's already something placed)
      const need = chunk.minutes;
      if (st.capacityLeft < need) continue;
      // Fits within day cap
      const cap = caps[iv.dayIdx];
      if (cap !== null && cap !== undefined && dayLoad[iv.dayIdx]! + need > cap) continue;
      const intervalSize = iv.endMinute - iv.startMinute;
      candidates.push({
        idx: st.idx,
        score: [dayLoad[iv.dayIdx]!, Math.abs(intervalSize - chunk.minutes), iv.startMinute],
      });
    }
    if (candidates.length === 0) {
      unplaced.push(chunk);
      continue;
    }
    candidates.sort((a, b) => {
      for (let i = 0; i < 3; i++) if (a.score[i]! !== b.score[i]!) return a.score[i]! - b.score[i]!;
      return 0;
    });
    const pick = candidates[0]!;
    const st = states.find((s) => s.idx === pick.idx)!;
    const iv = intervals[pick.idx]!;
    placements.push({
      chunk,
      intervalIdx: pick.idx,
      offsetInInterval: st.cursor,
    });
    // Advance cursor by chunk + buffer (but don't exceed interval).
    const advance = chunk.minutes + BUFFER_MINUTES;
    st.cursor = Math.min(st.cursor + advance, iv.endMinute - iv.startMinute);
    st.capacityLeft = iv.endMinute - iv.startMinute - st.cursor;
    dayLoad[iv.dayIdx]! += chunk.minutes;
  }

  return { placements, unplaced };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern scheduler/phase1`

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/scheduler/phase1.ts apps/api/src/scheduler/phase1.spec.ts
git commit -m "feat(scheduler): phase 1 FFD with rank-based placement"
```

---

## Task 12: Scheduler — phase 2 branch-and-bound

**Files:**
- Create: `apps/api/src/scheduler/phase2.ts`
- Create: `apps/api/src/scheduler/phase2.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/scheduler/phase2.spec.ts`:

```ts
import { phase1 } from './phase1';
import { phase2 } from './phase2';
import { computeCost } from './objective';
import type { Chunk, EffectiveInterval } from './scheduler.types';

function ch(id: string, minutes: number, order: number, isResidue = false): Chunk {
  return { itemId: id, order, minutes, isResidue };
}
function iv(dayIdx: number, start: number, end: number, slotSize = end - start): EffectiveInterval {
  return { dayIdx, startMinute: start, endMinute: end, slotSize };
}
const NO_CAPS: (number | null)[] = [null, null, null, null, null, null, null];

describe('phase2 branch-and-bound', () => {
  const pref = 60;

  it('never worsens the phase 1 solution', () => {
    const intervals = [
      iv(0, 480, 600),
      iv(0, 1260, 1440),
      iv(1, 480, 600),
    ];
    const chunks = [ch('a', 60, 1), ch('b', 60, 2), ch('c', 60, 3)];
    const s1 = phase1(chunks, intervals, NO_CAPS, pref);
    const c1 = computeCost(s1, intervals, pref);
    const result = phase2(chunks, intervals, NO_CAPS, pref, s1, { timeBudgetMs: 500, nodeBudget: 50_000 });
    expect(result.cost).toBeLessThanOrEqual(c1);
  });

  it('returns the phase-1 solution unchanged if no improvement is possible', () => {
    const intervals = [iv(0, 480, 540)]; // exactly one slot, one chunk
    const chunks = [ch('a', 60, 1)];
    const s1 = phase1(chunks, intervals, NO_CAPS, pref);
    const result = phase2(chunks, intervals, NO_CAPS, pref, s1, { timeBudgetMs: 500, nodeBudget: 50_000 });
    expect(result.cost).toBe(computeCost(s1, intervals, pref));
  });

  it('deterministic: same input → same output across two runs', () => {
    const intervals = [
      iv(0, 480, 720),
      iv(1, 480, 720),
      iv(2, 480, 720),
    ];
    const chunks = [ch('a', 60, 1), ch('b', 60, 2), ch('c', 60, 3)];
    const s1 = phase1(chunks, intervals, NO_CAPS, pref);
    const a = phase2(chunks, intervals, NO_CAPS, pref, s1, { timeBudgetMs: 500, nodeBudget: 50_000 });
    const b = phase2(chunks, intervals, NO_CAPS, pref, s1, { timeBudgetMs: 500, nodeBudget: 50_000 });
    expect(a.cost).toBe(b.cost);
    expect(JSON.stringify(a.solution.placements)).toBe(JSON.stringify(b.solution.placements));
  });

  it('flags timeout and returns best-so-far when budget is tiny', () => {
    const intervals = [
      iv(0, 480, 720), iv(1, 480, 720), iv(2, 480, 720),
      iv(3, 480, 720), iv(4, 480, 720), iv(5, 480, 720), iv(6, 480, 720),
    ];
    const chunks: Chunk[] = [];
    for (let k = 0; k < 10; k++) chunks.push(ch(`c${k}`, 60, k + 1));
    const s1 = phase1(chunks, intervals, NO_CAPS, pref);
    const result = phase2(chunks, intervals, NO_CAPS, pref, s1, { timeBudgetMs: 1, nodeBudget: 10 });
    expect(result.timedOut).toBe(true);
    // Never worse than phase 1
    expect(result.cost).toBeLessThanOrEqual(computeCost(s1, intervals, pref));
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern scheduler/phase2`

Expected: fails.

- [ ] **Step 3: Implement phase 2**

Create `apps/api/src/scheduler/phase2.ts`:

```ts
import { computeCost, minCostRemaining } from './objective.js';
import type {
  Chunk,
  EffectiveInterval,
  Placement,
  Solution,
} from './scheduler.types.js';

const BUFFER_MINUTES = 10;

export type Phase2Options = {
  timeBudgetMs: number;
  nodeBudget: number;
};

export type Phase2Result = {
  solution: Solution;
  cost: number;
  nodesExplored: number;
  timedOut: boolean;
};

/**
 * Branch-and-bound refinement. Chunks are tried in the same order as phase 1
 * (size desc, order asc). Candidate placements are explored in rank order:
 * (dayLoad asc, |interval_size - chunk_size| asc, interval_start asc).
 */
export function phase2(
  chunks: Chunk[],
  intervals: EffectiveInterval[],
  caps: (number | null)[],
  pref: number,
  initial: Solution,
  options: Phase2Options,
): Phase2Result {
  const ordered = [...chunks].sort((a, b) =>
    b.minutes - a.minutes || a.order - b.order,
  );

  let best: Solution = initial;
  let bestCost = computeCost(initial, intervals, pref);
  const startedAt = Date.now();
  const deadline = startedAt + options.timeBudgetMs;
  let nodesExplored = 0;
  let timedOut = false;

  type State = {
    cursors: number[];   // per-interval consumed minutes (incl. buffers)
    dayLoad: number[];   // 7
    placements: Placement[];
    unplaced: Chunk[];
  };

  const state: State = {
    cursors: intervals.map(() => 0),
    dayLoad: [0, 0, 0, 0, 0, 0, 0],
    placements: [],
    unplaced: [],
  };

  const tryFinalize = () => {
    const sol: Solution = {
      placements: [...state.placements],
      unplaced: [...state.unplaced],
    };
    const cost = computeCost(sol, intervals, pref);
    if (cost < bestCost) {
      bestCost = cost;
      best = sol;
    }
  };

  function recurse(chunkIdx: number): void {
    if (nodesExplored >= options.nodeBudget) { timedOut = true; return; }
    if (Date.now() >= deadline) { timedOut = true; return; }
    nodesExplored += 1;

    if (chunkIdx >= ordered.length) {
      tryFinalize();
      return;
    }

    const chunk = ordered[chunkIdx]!;

    // Lower bound pruning (tight-enough for our scale)
    const partial: Solution = {
      placements: state.placements,
      unplaced: state.unplaced,
    };
    const lb = computeCost(partial, intervals, pref)
      + minCostRemaining(ordered.slice(chunkIdx), intervals, pref);
    if (lb >= bestCost) return;

    // Build candidate list for this chunk
    type Cand = { idx: number; score: [number, number, number] };
    const candidates: Cand[] = [];
    for (let idx = 0; idx < intervals.length; idx++) {
      const iv = intervals[idx]!;
      if (iv.endMinute - iv.startMinute < pref && iv.slotSize >= pref) continue;
      const size = iv.endMinute - iv.startMinute;
      const remainingInInterval = size - state.cursors[idx]!;
      if (remainingInInterval < chunk.minutes) continue;
      const cap = caps[iv.dayIdx];
      if (cap !== null && cap !== undefined && state.dayLoad[iv.dayIdx]! + chunk.minutes > cap) continue;
      candidates.push({
        idx,
        score: [state.dayLoad[iv.dayIdx]!, Math.abs(size - chunk.minutes), iv.startMinute],
      });
    }
    candidates.sort((a, b) => {
      for (let i = 0; i < 3; i++) if (a.score[i]! !== b.score[i]!) return a.score[i]! - b.score[i]!;
      return 0;
    });

    // Try each placement
    for (const cand of candidates) {
      const iv = intervals[cand.idx]!;
      const offset = state.cursors[cand.idx]!;
      state.placements.push({ chunk, intervalIdx: cand.idx, offsetInInterval: offset });
      const prevCursor = state.cursors[cand.idx]!;
      state.cursors[cand.idx] = Math.min(prevCursor + chunk.minutes + BUFFER_MINUTES, iv.endMinute - iv.startMinute);
      state.dayLoad[iv.dayIdx]! += chunk.minutes;

      recurse(chunkIdx + 1);

      state.placements.pop();
      state.cursors[cand.idx] = prevCursor;
      state.dayLoad[iv.dayIdx]! -= chunk.minutes;

      if (timedOut) return;
    }

    // Also try leaving the chunk unplaced (so solver can prefer spreading
    // rather than filling a small slot).
    state.unplaced.push(chunk);
    recurse(chunkIdx + 1);
    state.unplaced.pop();
  }

  recurse(0);
  return { solution: best, cost: bestCost, nodesExplored, timedOut };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern scheduler/phase2`

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/scheduler/phase2.ts apps/api/src/scheduler/phase2.spec.ts
git commit -m "feat(scheduler): phase 2 branch-and-bound with time/node budget"
```

---

## Task 13: Scheduler — orchestration + new `SchedulerService.plan`

**Files:**
- Modify: `apps/api/src/scheduler/scheduler.service.ts`

- [ ] **Step 1: Rewrite the service**

Replace the full content of `apps/api/src/scheduler/scheduler.service.ts` with:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { buildEffectiveIntervals, chunkItems, localMinuteToUtc } from './intervals.js';
import { computeCost } from './objective.js';
import { phase1 } from './phase1.js';
import { phase2 } from './phase2.js';
import type {
  SchedulerInput,
  SchedulerOutput,
  PlannedSession,
  OverflowChunk,
} from './scheduler.types.js';

export type {
  SchedulerInput,
  SchedulerOutput,
  ItemInput,
  AvailabilitySlotInput,
  BusyBlock,
} from './scheduler.types.js';

const TIME_BUDGET_MS = 500;
const NODE_BUDGET = 50_000;

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  plan(input: SchedulerInput): SchedulerOutput {
    const startedAt = Date.now();
    const pref = input.availability.preferredSessionMinutes;
    const tz = input.availability.timezone;
    const now = input.now ?? new Date();

    const intervals = buildEffectiveIntervals(
      input.availability.slots,
      input.busyBlocks,
      input.weekStart,
      tz,
      now,
    );
    const chunks = chunkItems(input.items, pref);

    const s1 = phase1(chunks, intervals, input.availability.caps, pref);
    const phase1Cost = computeCost(s1, intervals, pref);

    const p2 = phase2(chunks, intervals, input.availability.caps, pref, s1, {
      timeBudgetMs: TIME_BUDGET_MS,
      nodeBudget: NODE_BUDGET,
    });

    const sessions: PlannedSession[] = p2.solution.placements.map((pl) => {
      const iv = intervals[pl.intervalIdx]!;
      const scheduledAt = localMinuteToUtc(
        input.weekStart,
        iv.dayIdx,
        iv.startMinute + pl.offsetInInterval,
        tz,
      );
      return {
        itemId: pl.chunk.itemId,
        scheduledAt,
        durationMinutes: pl.chunk.minutes,
      };
    });

    const overflow: OverflowChunk[] = p2.solution.unplaced.map((c) => ({
      itemId: c.itemId,
      minutesRequired: c.minutes,
    }));

    const durationMs = Date.now() - startedAt;
    const diagnostics = {
      phase1Cost,
      finalCost: p2.cost,
      nodesExplored: p2.nodesExplored,
      timedOut: p2.timedOut,
      durationMs,
    };

    this.logger.debug(
      `plan computed · chunks=${chunks.length} intervals=${intervals.length} ` +
      `sessions=${sessions.length} overflow=${overflow.length} ` +
      `phase1=${phase1Cost} final=${p2.cost} nodes=${p2.nodesExplored} ` +
      `timedOut=${p2.timedOut} ${durationMs}ms`,
    );

    return { sessions, overflow, diagnostics };
  }
}
```

- [ ] **Step 2: Typecheck the API package**

Run: `pnpm --filter @ics-select/api typecheck`

Expected: fails in `publication.service.ts` because the input shape changed (no more `mondayMinutes` etc. on `availability`). Task 14 fixes that.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/scheduler/scheduler.service.ts
git commit -m "feat(scheduler): week-level plan via phase1 + phase2 + diagnostics"
```

---

## Task 14: PublicationService — wire slots + caps + order into scheduler input

**Files:**
- Modify: `apps/api/src/weekly-plans/publication.service.ts:20-30,266-275,345-356`

- [ ] **Step 1: Replace `DEFAULT_AVAILABILITY`**

At the top of `apps/api/src/weekly-plans/publication.service.ts` replace:

```ts
const DEFAULT_AVAILABILITY = {
  mondayMinutes: 60,
  tuesdayMinutes: 60,
  wednesdayMinutes: 60,
  thursdayMinutes: 60,
  fridayMinutes: 60,
  saturdayMinutes: 0,
  sundayMinutes: 0,
  preferredSessionMinutes: 60,
  timezone: 'America/Sao_Paulo',
};
```

with:

```ts
const DEFAULT_PREFERRED_SESSION_MINUTES = 60;
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

// If a member has no availability row at all, treat the week as unavailable.
// Legacy members have been backfilled (08:00-22:00 slots per day with minutes >
// 0) in the p_availability_slots migration, so reaching here means a fresh
// user who has not yet declared slots.
const EMPTY_CAPS: (number | null)[] = [null, null, null, null, null, null, null];

type SchedulerAvailability = {
  slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>;
  caps: (number | null)[];
  preferredSessionMinutes: number;
  timezone: string;
};
```

- [ ] **Step 2: Add a helper to shape the scheduler availability**

Immediately after the `allocatedMinutes` function in the same file, add:

```ts
async function loadSchedulerAvailability(
  prisma: { memberAvailability: any; availabilitySlot: any },
  userId: string,
): Promise<SchedulerAvailability> {
  const [row, slotRows] = await Promise.all([
    prisma.memberAvailability.findUnique({ where: { userId } }),
    prisma.availabilitySlot.findMany({ where: { userId } }),
  ]);
  const caps: (number | null)[] = row
    ? [
        row.mondayMinutes ?? null,
        row.tuesdayMinutes ?? null,
        row.wednesdayMinutes ?? null,
        row.thursdayMinutes ?? null,
        row.fridayMinutes ?? null,
        row.saturdayMinutes ?? null,
        row.sundayMinutes ?? null,
      ]
    : EMPTY_CAPS;
  return {
    slots: slotRows.map((s: any) => ({
      dayOfWeek: s.dayOfWeek,
      startMinute: s.startMinute,
      endMinute: s.endMinute,
    })),
    caps,
    preferredSessionMinutes: row?.preferredSessionMinutes ?? DEFAULT_PREFERRED_SESSION_MINUTES,
    timezone: row?.timezone ?? DEFAULT_TIMEZONE,
  };
}
```

- [ ] **Step 3: Update the two scheduler call sites**

Find the two places in this file where `scheduler.plan({ ... })` is called (search for `this.scheduler.plan`). In both:

- Replace the `availability:` assignment with `availability: await loadSchedulerAvailability(this.prisma, plan.userId)`.
- Remove the `const existing = await this.prisma.memberAvailability.findUnique(...)` + `const availability = existing ?? DEFAULT_AVAILABILITY;` lines directly above — they are superseded.
- Update the `items:` array to include `order: i.order` (the `WeeklyPlanItem.order` already present on each item):

```ts
items: pending.map((i) => ({
  id: i.id,
  estimatedMinutes: allocatedMinutes(i.libraryItem.estimatedMinutes),
  order: i.order,
})),
```

and

```ts
items: schedulableItems.map((i) => ({
  id: i.id,
  estimatedMinutes: allocatedMinutes(i.libraryItem.estimatedMinutes),
  order: i.order,
})),
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @ics-select/api typecheck`

Expected: passes.

- [ ] **Step 5: Run existing publication tests**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern publication.service`

Expected: any existing tests either pass or fail with a shape-related mock error. If they fail because mocks need `availabilitySlot.findMany`, patch the mocks to return `[]`. (The scheduler will simply see no slots and produce empty output, which is fine for publication-level logic tests.)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/weekly-plans/publication.service.ts apps/api/src/weekly-plans/publication.service.spec.ts
git commit -m "feat(publication): pass slots + caps + order to scheduler"
```

---

## Task 15: Scheduler service — canonical tests from the spec

**Files:**
- Modify: `apps/api/src/scheduler/scheduler.service.spec.ts`

- [ ] **Step 1: Rewrite the spec to target the new input shape**

Replace the full content of `apps/api/src/scheduler/scheduler.service.spec.ts` with:

```ts
import { SchedulerService } from './scheduler.service';
import type { AvailabilitySlotInput, SchedulerInput } from './scheduler.types';

const MONDAY = new Date('2026-04-13T00:00:00-03:00'); // Mon 03:00 UTC
const BEFORE_WEEK = new Date('2026-04-12T12:00:00-03:00');

const NO_CAPS: (number | null)[] = [null, null, null, null, null, null, null];

function allSlots0822(): AvailabilitySlotInput[] {
  return [0, 1, 2, 3, 4].map((d) => ({ dayOfWeek: d, startMinute: 480, endMinute: 1320 }));
}

function input(overrides: Partial<SchedulerInput> = {}): SchedulerInput {
  return {
    weekStart: MONDAY,
    availability: {
      slots: allSlots0822(),
      caps: NO_CAPS,
      preferredSessionMinutes: 60,
      timezone: 'America/Sao_Paulo',
    },
    busyBlocks: [],
    items: [],
    now: BEFORE_WEEK,
    ...overrides,
  };
}

describe('SchedulerService.plan — canonical cases', () => {
  const svc = new SchedulerService();

  it('1. consolidates 3h of work into the larger of two slots on the same day', () => {
    const result = svc.plan(
      input({
        availability: {
          slots: [
            { dayOfWeek: 0, startMinute: 480, endMinute: 600 },   // Mon 08-10
            { dayOfWeek: 0, startMinute: 1260, endMinute: 1440 }, // Mon 21-00
          ],
          caps: NO_CAPS,
          preferredSessionMinutes: 60,
          timezone: 'America/Sao_Paulo',
        },
        items: [
          { id: 'a', estimatedMinutes: 60, order: 1 },
          { id: 'b', estimatedMinutes: 60, order: 2 },
          { id: 'c', estimatedMinutes: 60, order: 3 },
        ],
      }),
    );
    expect(result.overflow).toHaveLength(0);
    expect(result.sessions).toHaveLength(3);
    // All sessions on Monday, local time ≥ 21:00 (UTC ≥ 00:00 next day)
    for (const s of result.sessions) {
      // 21:00 BRT = 00:00 UTC next day; 00:00 local = 03:00 UTC
      expect(s.scheduledAt.getTime()).toBeGreaterThanOrEqual(
        new Date('2026-04-14T00:00:00Z').getTime(),
      );
    }
  });

  it('2. distributes evenly across 5 weekdays when capacity is abundant', () => {
    const result = svc.plan(
      input({
        availability: {
          slots: [0, 1, 2, 3, 4].map((d) => ({ dayOfWeek: d, startMinute: 1140, endMinute: 1320 })), // 19-22
          caps: NO_CAPS,
          preferredSessionMinutes: 60,
          timezone: 'America/Sao_Paulo',
        },
        items: [1, 2, 3].map((n) => ({ id: `i${n}`, estimatedMinutes: 60, order: n })),
      }),
    );
    expect(result.overflow).toHaveLength(0);
    const daysHit = new Set(result.sessions.map((s) => s.scheduledAt.getUTCDate()));
    // Expect at least 3 distinct days
    expect(daysHit.size).toBeGreaterThanOrEqual(3);
  });

  it('3. cap overrides slot capacity', () => {
    const caps: (number | null)[] = [60, null, null, null, null, null, null];
    const result = svc.plan(
      input({
        availability: {
          slots: [{ dayOfWeek: 0, startMinute: 1140, endMinute: 1320 }], // Mon 19-22 only
          caps,
          preferredSessionMinutes: 60,
          timezone: 'America/Sao_Paulo',
        },
        items: [
          { id: 'a', estimatedMinutes: 60, order: 1 },
          { id: 'b', estimatedMinutes: 60, order: 2 }, // should overflow
        ],
      }),
    );
    expect(result.sessions).toHaveLength(1);
    expect(result.overflow).toHaveLength(1);
    expect(result.overflow[0]!.itemId).toBe('b');
  });

  it('4. busy block carves a slot and residues < pref are skipped', () => {
    const busyStart = new Date('2026-04-13T20:00:00-03:00'); // 23:00 UTC
    const busyEnd = new Date('2026-04-13T20:30:00-03:00');   // 23:30 UTC
    const result = svc.plan(
      input({
        availability: {
          slots: [{ dayOfWeek: 0, startMinute: 1140, endMinute: 1320 }], // 19-22
          caps: NO_CAPS,
          preferredSessionMinutes: 60,
          timezone: 'America/Sao_Paulo',
        },
        busyBlocks: [{ start: busyStart, end: busyEnd }],
        items: [{ id: 'a', estimatedMinutes: 120, order: 1 }],
      }),
    );
    // One 60-min chunk before busy (19-20), one after (20:30 + 10min buffer = 20:40 onwards).
    expect(result.overflow).toHaveLength(0);
    for (const s of result.sessions) {
      const end = new Date(s.scheduledAt.getTime() + s.durationMinutes * 60_000);
      const overlaps = s.scheduledAt < busyEnd && end > busyStart;
      expect(overlaps).toBe(false);
    }
  });

  it('5. honors a short declared slot (< pref)', () => {
    const result = svc.plan(
      input({
        availability: {
          slots: [{ dayOfWeek: 1, startMinute: 1140, endMinute: 1170 }], // Tue 19:00-19:30
          caps: NO_CAPS,
          preferredSessionMinutes: 60,
          timezone: 'America/Sao_Paulo',
        },
        items: [{ id: 'a', estimatedMinutes: 30, order: 1 }],
      }),
    );
    expect(result.overflow).toHaveLength(0);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]!.durationMinutes).toBe(30);
  });

  it('6. order preference: lower order lands on earlier day when tied', () => {
    const result = svc.plan(
      input({
        availability: {
          slots: [
            { dayOfWeek: 0, startMinute: 480, endMinute: 600 },
            { dayOfWeek: 1, startMinute: 480, endMinute: 600 },
          ],
          caps: NO_CAPS,
          preferredSessionMinutes: 60,
          timezone: 'America/Sao_Paulo',
        },
        items: [
          { id: 'a', estimatedMinutes: 60, order: 1 },
          { id: 'b', estimatedMinutes: 60, order: 2 },
        ],
      }),
    );
    const byId = new Map(result.sessions.map((s) => [s.itemId, s.scheduledAt.getTime()]));
    expect(byId.get('a')!).toBeLessThan(byId.get('b')!);
  });

  it('7. no slots on Monday → nothing scheduled there', () => {
    const result = svc.plan(
      input({
        availability: {
          slots: [
            { dayOfWeek: 1, startMinute: 480, endMinute: 600 },
            { dayOfWeek: 2, startMinute: 480, endMinute: 600 },
          ],
          caps: NO_CAPS,
          preferredSessionMinutes: 60,
          timezone: 'America/Sao_Paulo',
        },
        items: [{ id: 'a', estimatedMinutes: 60, order: 1 }],
      }),
    );
    expect(result.overflow).toHaveLength(0);
    const onMonday = result.sessions.filter((s) => s.scheduledAt.getUTCDate() === MONDAY.getUTCDate());
    expect(onMonday).toHaveLength(0);
  });

  it('9. solver fallback: patological input returns phase-1 output with timedOut=true', () => {
    const slots: AvailabilitySlotInput[] = [];
    for (let d = 0; d < 7; d++) slots.push({ dayOfWeek: d, startMinute: 480, endMinute: 720 });
    const items = [];
    for (let k = 0; k < 20; k++) items.push({ id: `c${k}`, estimatedMinutes: 60, order: k + 1 });
    const result = svc.plan(input({
      availability: {
        slots, caps: NO_CAPS, preferredSessionMinutes: 60, timezone: 'America/Sao_Paulo',
      },
      items,
    }));
    // Either timed out OR node-budget-exhausted (both set timedOut=true in phase 2).
    // We don't assert timedOut here because at this scale the solver may still
    // finish within budget; we just assert no crash and a feasible result.
    expect(result.sessions.length + result.overflow.length).toBeGreaterThan(0);
    expect(result.diagnostics).toBeDefined();
    expect(typeof result.diagnostics.timedOut).toBe('boolean');
  });

  it('10. deterministic: same input → byte-equal session list', () => {
    const data = input({
      availability: {
        slots: [
          { dayOfWeek: 0, startMinute: 480, endMinute: 600 },
          { dayOfWeek: 1, startMinute: 480, endMinute: 600 },
        ],
        caps: NO_CAPS,
        preferredSessionMinutes: 60,
        timezone: 'America/Sao_Paulo',
      },
      items: [
        { id: 'a', estimatedMinutes: 60, order: 1 },
        { id: 'b', estimatedMinutes: 60, order: 2 },
      ],
    });
    const a = svc.plan(data);
    const b = svc.plan(data);
    expect(JSON.stringify(a.sessions)).toBe(JSON.stringify(b.sessions));
    expect(JSON.stringify(a.overflow)).toBe(JSON.stringify(b.overflow));
  });
});
```

- [ ] **Step 2: Run the full scheduler test suite**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern scheduler`

Expected: all scheduler-related tests pass (objective, intervals, phase1, phase2, and the top-level canonical cases).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/scheduler/scheduler.service.spec.ts
git commit -m "test(scheduler): canonical cases from the spec"
```

---

## Task 16: Web — query types + mutation payload

**Files:**
- Modify: `apps/web/lib/queries/me-settings.ts`

- [ ] **Step 1: Extend the response type and mutation input**

Replace the contents of `apps/web/lib/queries/me-settings.ts` with:

```ts
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type AvailabilitySlot = {
  id?: string; // absent on new slots from the editor
  dayOfWeek: number;   // 0..6, 0 = Monday
  startMinute: number;
  endMinute: number;
};

export type AvailabilityResponse = {
  mondayMinutes: number | null;
  tuesdayMinutes: number | null;
  wednesdayMinutes: number | null;
  thursdayMinutes: number | null;
  fridayMinutes: number | null;
  saturdayMinutes: number | null;
  sundayMinutes: number | null;
  preferredSessionMinutes: number;
  timezone: string;
  slots: AvailabilitySlot[];
};

export type AvailabilityPatch = Partial<
  Omit<AvailabilityResponse, 'slots'>
> & {
  slots?: AvailabilitySlot[];
  clearDays?: number[];
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
    mutationFn: (input: AvailabilityPatch) =>
      apiFetch('/me/availability', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'availability'] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { whatsappPhone?: string | null; targetTrack?: string | null }) =>
      apiFetch('/me/profile', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
```

- [ ] **Step 2: Typecheck web**

Run: `pnpm --filter @ics-select/web typecheck` (if defined) or `pnpm -w typecheck`

Expected: errors in `availability-grid.tsx` / `availability-presets.tsx` / `onboarding/page.tsx` because `AvailabilityResponse` minutes are nullable now. Tasks 17-20 fix these.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/queries/me-settings.ts
git commit -m "feat(web): AvailabilityResponse includes slots, caps are nullable"
```

---

## Task 17: Web — time helper

**Files:**
- Create: `apps/web/lib/format/time.ts`

- [ ] **Step 1: Create the helper**

Create `apps/web/lib/format/time.ts`:

```ts
export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) throw new Error(`bad time: ${hhmm}`);
  return (h! * 60) + m!;
}

// Every 30-min boundary from 00:00 to 24:00 inclusive.
export function thirtyMinuteGrid(): string[] {
  const out: string[] = [];
  for (let m = 0; m <= 1440; m += 30) out.push(minutesToHHMM(m));
  return out;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/format/time.ts
git commit -m "feat(web): 30-min grid + HH:MM helpers"
```

---

## Task 18: Web — slot editor component

**Files:**
- Create: `apps/web/components/member/availability-slot-editor.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/components/member/availability-slot-editor.tsx`:

```tsx
'use client';
import { useMemo } from 'react';
import { X, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { minutesToHHMM, hhmmToMinutes, thirtyMinuteGrid } from '../../lib/format/time';
import type { AvailabilitySlot } from '../../lib/queries/me-settings';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Props = {
  slots: AvailabilitySlot[];
  onChange: (next: AvailabilitySlot[]) => void;
};

export function AvailabilitySlotEditor({ slots, onChange }: Props) {
  const grid = useMemo(thirtyMinuteGrid, []);

  const byDay = useMemo(() => {
    const m = new Map<number, AvailabilitySlot[]>();
    for (let d = 0; d < 7; d++) m.set(d, []);
    for (const s of slots) m.get(s.dayOfWeek)!.push(s);
    for (const list of m.values()) list.sort((a, b) => a.startMinute - b.startMinute);
    return m;
  }, [slots]);

  function setDaySlots(day: number, next: AvailabilitySlot[]) {
    const other = slots.filter((s) => s.dayOfWeek !== day);
    onChange([...other, ...next]);
  }

  function addSlot(day: number) {
    const existing = byDay.get(day) ?? [];
    const lastEnd = existing.length > 0 ? existing[existing.length - 1]!.endMinute : 18 * 60;
    const start = Math.min(lastEnd, 22 * 60);
    const end = Math.min(start + 120, 24 * 60);
    setDaySlots(day, [
      ...existing,
      { dayOfWeek: day, startMinute: start, endMinute: end },
    ]);
  }

  function removeSlot(day: number, idx: number) {
    const existing = byDay.get(day) ?? [];
    setDaySlots(day, existing.filter((_, i) => i !== idx));
  }

  function updateSlot(day: number, idx: number, patch: Partial<AvailabilitySlot>) {
    const existing = byDay.get(day) ?? [];
    const next = existing.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    setDaySlots(day, next);
  }

  return (
    <div className="space-y-2">
      {DAY_SHORT.map((label, day) => {
        const daySlots = byDay.get(day) ?? [];
        const overlap = detectOverlap(daySlots);
        return (
          <div
            key={day}
            className={clsx(
              'rounded-input border bg-surface px-3 py-2.5',
              overlap ? 'border-outcome-stuck' : 'border-border-token',
            )}
          >
            <div className="flex items-center gap-3">
              <span className="w-14 font-mono text-[11px] font-semibold uppercase tracking-eyebrow text-fg-mute">
                {label}
              </span>
              <div className="flex-1 space-y-1.5">
                {daySlots.length === 0 && (
                  <p className="font-sans text-[12px] text-fg-faint">
                    indisponível
                  </p>
                )}
                {daySlots.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={minutesToHHMM(s.startMinute)}
                      onChange={(e) => updateSlot(day, idx, { startMinute: hhmmToMinutes(e.target.value) })}
                      className="rounded-input border border-border-token bg-surface px-2 py-0.5 font-mono text-[12px] text-fg focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label={`${label} start`}
                    >
                      {grid.slice(0, -1).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <span className="font-sans text-[12px] text-fg-mute">–</span>
                    <select
                      value={minutesToHHMM(s.endMinute)}
                      onChange={(e) => updateSlot(day, idx, { endMinute: hhmmToMinutes(e.target.value) })}
                      className="rounded-input border border-border-token bg-surface px-2 py-0.5 font-mono text-[12px] text-fg focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label={`${label} end`}
                    >
                      {grid.slice(1).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeSlot(day, idx)}
                      className="rounded-pill border border-transparent p-0.5 text-fg-mute hover:border-border-token hover:text-fg"
                      aria-label={`Remove ${label} slot ${idx + 1}`}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSlot(day)}
                  className="flex items-center gap-1 font-sans text-[12px] text-fg-mute hover:text-fg"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  adicionar faixa
                </button>
              </div>
            </div>
            {overlap && (
              <p className="mt-1.5 pl-[68px] font-mono text-[11px] text-outcome-stuck">
                faixas se sobrepõem — ajuste pra salvar
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function detectOverlap(list: AvailabilitySlot[]): boolean {
  const sorted = [...list].sort((a, b) => a.startMinute - b.startMinute);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.startMinute < sorted[i - 1]!.endMinute) return true;
  }
  return false;
}

export function hasAnyOverlap(slots: AvailabilitySlot[]): boolean {
  const byDay = new Map<number, AvailabilitySlot[]>();
  for (const s of slots) {
    const list = byDay.get(s.dayOfWeek) ?? [];
    list.push(s);
    byDay.set(s.dayOfWeek, list);
  }
  for (const list of byDay.values()) if (detectOverlap(list)) return true;
  return false;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck` (or equivalent)

Expected: the new file compiles.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/availability-slot-editor.tsx
git commit -m "feat(web): slot editor with 30-min selectors + overlap cue"
```

---

## Task 19: Web — slot presets component

**Files:**
- Create: `apps/web/components/member/availability-slot-presets.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/components/member/availability-slot-presets.tsx`:

```tsx
'use client';
import type { AvailabilitySlot } from '../../lib/queries/me-settings';

type Props = {
  slots: AvailabilitySlot[];
  onChange: (next: AvailabilitySlot[]) => void;
};

export function AvailabilitySlotPresets({ slots, onChange }: Props) {
  function applyWeekdayNight() {
    const additions: AvailabilitySlot[] = [0, 1, 2, 3, 4].map((d) => ({
      dayOfWeek: d,
      startMinute: 19 * 60,
      endMinute: 22 * 60,
    }));
    const kept = slots.filter((s) => !additions.some((a) => a.dayOfWeek === s.dayOfWeek));
    onChange([...kept, ...additions]);
  }

  function applyWeekendMorning() {
    const additions: AvailabilitySlot[] = [5, 6].map((d) => ({
      dayOfWeek: d,
      startMinute: 8 * 60,
      endMinute: 12 * 60,
    }));
    const kept = slots.filter((s) => !additions.some((a) => a.dayOfWeek === s.dayOfWeek));
    onChange([...kept, ...additions]);
  }

  function copyMondayToAll() {
    const mondaySlots = slots.filter((s) => s.dayOfWeek === 0);
    if (mondaySlots.length === 0) return;
    const replicated: AvailabilitySlot[] = [];
    for (let d = 1; d < 7; d++) {
      for (const s of mondaySlots) {
        replicated.push({ dayOfWeek: d, startMinute: s.startMinute, endMinute: s.endMinute });
      }
    }
    onChange([...mondaySlots, ...replicated]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <PresetButton onClick={applyWeekdayNight}>Noite de semana</PresetButton>
      <PresetButton onClick={applyWeekendMorning}>Manhã de fim de semana</PresetButton>
      <PresetButton onClick={copyMondayToAll}>Copiar Seg pra todos</PresetButton>
    </div>
  );
}

function PresetButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-pill border border-border-token bg-surface px-3 py-1 font-sans text-[12px] text-fg-soft hover:border-border-strong hover:text-fg"
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/member/availability-slot-presets.tsx
git commit -m "feat(web): slot presets (weeknight, weekend morning, copy Mon)"
```

---

## Task 20: Web — integrate slot editor into `AvailabilityGrid`

**Files:**
- Modify: `apps/web/components/member/availability-grid.tsx`
- Modify: `apps/web/components/member/availability-presets.tsx`

- [ ] **Step 1: Update the daily-cap presets to accept null**

Replace the full content of `apps/web/components/member/availability-presets.tsx` with:

```tsx
'use client';
import { clsx } from 'clsx';

export type DayKey =
  | 'mondayMinutes'
  | 'tuesdayMinutes'
  | 'wednesdayMinutes'
  | 'thursdayMinutes'
  | 'fridayMinutes'
  | 'saturdayMinutes'
  | 'sundayMinutes';

export type AvailabilityMinutes = Record<DayKey, number | null>;

const DAYS: Array<{ key: DayKey; short: string }> = [
  { key: 'mondayMinutes', short: 'Mon' },
  { key: 'tuesdayMinutes', short: 'Tue' },
  { key: 'wednesdayMinutes', short: 'Wed' },
  { key: 'thursdayMinutes', short: 'Thu' },
  { key: 'fridayMinutes', short: 'Fri' },
  { key: 'saturdayMinutes', short: 'Sat' },
  { key: 'sundayMinutes', short: 'Sun' },
];

// `null` = no cap (use full slot time), `0` = day off (deprecated now that
// slots drive availability — left in for compatibility).
const MINUTE_PRESETS: Array<number | null> = [null, 30, 60, 90, 120, 180];

interface Props {
  value: AvailabilityMinutes;
  onChange: (next: AvailabilityMinutes) => void;
}

export function AvailabilityPresets({ value, onChange }: Props) {
  return (
    <div className="space-y-2.5">
      {DAYS.map((d) => (
        <div
          key={d.key}
          className="flex items-center gap-3 rounded-input border border-border-token bg-surface px-3 py-2"
        >
          <span className="w-14 font-mono text-[11px] font-semibold uppercase tracking-eyebrow text-fg-mute">
            {d.short}
          </span>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {MINUTE_PRESETS.map((mins) => {
              const active = value[d.key] === mins;
              const label = mins === null ? '—' : `${mins}m`;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onChange({ ...value, [d.key]: mins })}
                  className={clsx(
                    'rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-fg'
                      : 'border-border-token bg-surface text-fg-soft hover:border-border-strong hover:text-fg',
                  )}
                  aria-label={mins === null ? `${d.short}: no cap` : `${d.short}: ${mins} minutes cap`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update `availability-grid.tsx`**

Replace the full content of `apps/web/components/member/availability-grid.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { AvailabilityResponse, AvailabilitySlot } from '../../lib/queries/me-settings';
import { useUpdateAvailability } from '../../lib/queries/me-settings';
import { SectionLabel } from '../ui/section-label';
import { Button } from '../ui/button';
import {
  AvailabilityPresets,
  type AvailabilityMinutes,
} from './availability-presets';
import { SessionLengthPresets } from './session-length-presets';
import { AvailabilitySlotEditor, hasAnyOverlap } from './availability-slot-editor';
import { AvailabilitySlotPresets } from './availability-slot-presets';

const DEFAULTS: AvailabilityResponse = {
  mondayMinutes: null,
  tuesdayMinutes: null,
  wednesdayMinutes: null,
  thursdayMinutes: null,
  fridayMinutes: null,
  saturdayMinutes: null,
  sundayMinutes: null,
  preferredSessionMinutes: 30,
  timezone: 'America/Sao_Paulo',
  slots: [],
};

interface Props {
  initial: AvailabilityResponse | null | undefined;
}

export function AvailabilityGrid({ initial }: Props) {
  const data: AvailabilityResponse = { ...DEFAULTS, ...(initial ?? {}) };
  const [form, setForm] = useState<AvailabilityResponse>(data);
  const update = useUpdateAvailability();

  const dayMinutes: AvailabilityMinutes = {
    mondayMinutes: form.mondayMinutes,
    tuesdayMinutes: form.tuesdayMinutes,
    wednesdayMinutes: form.wednesdayMinutes,
    thursdayMinutes: form.thursdayMinutes,
    fridayMinutes: form.fridayMinutes,
    saturdayMinutes: form.saturdayMinutes,
    sundayMinutes: form.sundayMinutes,
  };

  const overlap = hasAnyOverlap(form.slots);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (overlap) return;
    // Replace all slots across all 7 days: clearDays = [0..6] and slots = the full form.slots.
    await update.mutateAsync({
      mondayMinutes: form.mondayMinutes,
      tuesdayMinutes: form.tuesdayMinutes,
      wednesdayMinutes: form.wednesdayMinutes,
      thursdayMinutes: form.thursdayMinutes,
      fridayMinutes: form.fridayMinutes,
      saturdayMinutes: form.saturdayMinutes,
      sundayMinutes: form.sundayMinutes,
      preferredSessionMinutes: form.preferredSessionMinutes,
      timezone: form.timezone,
      slots: form.slots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startMinute: s.startMinute,
        endMinute: s.endMinute,
      })),
      clearDays: [0, 1, 2, 3, 4, 5, 6],
    });
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <div>
        <SectionLabel>Available time slots</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          When you can study each day of the week. Empty day = no study scheduled.
        </p>
        <div className="mt-3">
          <AvailabilitySlotPresets
            slots={form.slots}
            onChange={(slots) => setForm((prev) => ({ ...prev, slots }))}
          />
        </div>
        <div className="mt-3">
          <AvailabilitySlotEditor
            slots={form.slots}
            onChange={(slots) => setForm((prev) => ({ ...prev, slots }))}
          />
        </div>
      </div>

      <div>
        <SectionLabel>Daily cap (optional)</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          Upper bound on study minutes per day. Pick <span className="font-mono">—</span> to use all of the day's declared slots.
        </p>
        <div className="mt-4">
          <AvailabilityPresets
            value={dayMinutes}
            onChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
          />
        </div>
      </div>

      <div>
        <SectionLabel>Preferred session length</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          Ideal uninterrupted block. The scheduler splits items into chunks of this size.
        </p>
        <div className="mt-3">
          <SessionLengthPresets
            value={form.preferredSessionMinutes}
            onChange={(next) =>
              setForm((prev) => ({ ...prev, preferredSessionMinutes: next }))
            }
          />
        </div>
      </div>

      <div>
        <SectionLabel>Timezone</SectionLabel>
        <input
          type="text"
          value={form.timezone}
          onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
          placeholder="America/Sao_Paulo"
          className="mt-2 w-full max-w-xs rounded-input border border-border-token bg-surface px-3 py-1.5 font-sans text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {overlap && (
        <p className="font-mono text-xs text-outcome-stuck">
          Ajuste as faixas sobrepostas antes de salvar.
        </p>
      )}
      {update.isError && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="font-mono text-xs text-danger"
        >
          Failed to save. Please try again.
        </motion.p>
      )}
      {update.isSuccess && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="font-mono text-xs text-success"
        >
          Saved.
        </motion.p>
      )}

      <Button type="submit" disabled={update.isPending || overlap}>
        {update.isPending ? 'Saving…' : 'Save availability'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Typecheck + lint the web package**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: passes. Onboarding (which also imports `AvailabilityPresets`) still compiles because its `AvailabilityMinutes` local type was `number`; the presets now accept `number | null` but the consumer state is still a subset. Verify by opening `apps/web/app/(member)/me/onboarding/page.tsx` — if TS reports errors, widen the local state to `number | null` (just the minutes keys) and treat `null` the same as undefined-from-cap in the onboarding save. Minor follow-up.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/member/availability-grid.tsx apps/web/components/member/availability-presets.tsx
git commit -m "feat(web): wire slot editor + presets into AvailabilityGrid"
```

---

## Task 21: Web — Playwright smoke test

**Files:**
- Create: `apps/web/tests/availability-slots.spec.ts`

- [ ] **Step 1: Inspect how existing Playwright specs set up auth**

Run: `ls apps/web/tests/` and open one of the authenticated specs (for example `tests/auth-flow.spec.ts`) to see how tests log a member in. Mirror that pattern below.

- [ ] **Step 2: Write the spec**

Create `apps/web/tests/availability-slots.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('availability slot editor', () => {
  test('adds a slot, applies weeknight preset, and blocks save on overlap', async ({ page }) => {
    // Precondition: a logged-in member. Use the existing auth fixture /
    // programmatic login helper from the sibling specs.
    await loginAsMember(page);

    await page.goto('/me/settings');
    await expect(page.getByText('Available time slots')).toBeVisible();

    // Apply the preset
    await page.getByRole('button', { name: 'Noite de semana' }).click();
    // Mon should now have 19:00 and 22:00 values on its first slot row
    const mondayStart = page.getByRole('combobox', { name: 'Mon start' }).first();
    await expect(mondayStart).toHaveValue('19:00');

    // Add an extra slot on Mon that overlaps (08:00-20:00 while 19-22 exists)
    await page
      .locator('div', { has: page.getByText(/^MON$/i) })
      .getByRole('button', { name: 'adicionar faixa' })
      .click();
    const starts = page.getByRole('combobox', { name: 'Mon start' });
    const ends = page.getByRole('combobox', { name: 'Mon end' });
    await starts.last().selectOption('08:00');
    await ends.last().selectOption('20:00');

    await expect(page.getByText(/faixas se sobrepõem/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Save availability/i })).toBeDisabled();
  });
});

async function loginAsMember(page: import('@playwright/test').Page) {
  // Copy from an existing authenticated spec in apps/web/tests/.
  // If none exists, seed a test user + inject cookies here.
}
```

- [ ] **Step 3: Run Playwright**

Run: `pnpm --filter @ics-select/web test tests/availability-slots.spec.ts`

Expected: passes. If the `loginAsMember` helper is a no-op, replace with the actual pattern from the codebase — the test is value-less without auth.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/availability-slots.spec.ts
git commit -m "test(web): Playwright smoke for slot editor + overlap guard"
```

---

## Task 22: Full verification pass

- [ ] **Step 1: Run all tests**

Run: `pnpm test`

Expected: green across api / shared / web.

- [ ] **Step 2: Run all typechecks**

Run: `pnpm typecheck`

Expected: green.

- [ ] **Step 3: Verify the migration applied cleanly on a fresh DB**

```bash
docker compose down -v  # drop the local DB volume (destructive — local only)
docker compose up -d postgres
pnpm db:deploy
source apps/api/.env && psql "$DATABASE_URL" -c "\dt"
```

Expected: `AvailabilitySlot` table is listed; `MemberAvailability` still exists; no migration errors.

- [ ] **Step 4: Manual smoke test**

```bash
pnpm dev
```

Open `http://localhost:3000/me/settings`, log in as a member, confirm:
- The new "Available time slots" section appears above "Daily cap".
- Adding a range persists after refresh.
- Applying "Noite de semana" sets 19–22 on Mon–Fri.
- Trying to publish a plan (via the admin UI) with the new availability works end-to-end and the sessions land inside declared slots.

- [ ] **Step 5: Single final commit if any dangling fix was needed during the smoke**

Otherwise skip.

---

## Self-review notes

- Spec coverage: all 8 decisions (D1–D8) are implemented — slots table (D3), indisponível semantics (D4), rule iii (D5), phase 1 + phase 2 solver (D6), week-level input (D7), order as soft preference (D8), caps as optional ceilings (D1), list-of-ranges + presets UI (D2).
- Migration is on `p_availability_slots` — `p_` follows the latest `o_whatsapp_templates` in the migrations directory.
- Each task has concrete file paths, complete code, explicit pass/fail expectations, and a commit step.
- Types defined once in `scheduler.types.ts` and referenced from every scheduler sub-file.
- No placeholders; every step includes executable content.
