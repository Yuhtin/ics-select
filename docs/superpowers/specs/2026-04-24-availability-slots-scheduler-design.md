# Availability Slots + Week-Level Scheduler — Design Spec

**Date:** 2026-04-24
**Scope:** Add granular availability (time-of-day slots per weekday) to `MemberAvailability`, migrate scheduler from per-day greedy with a hardcoded 08:00–22:00 window to a week-level branch-and-bound solver with heuristic construction. Existing `preferredSessionMinutes` and per-day minute caps are preserved; the caps become optional ceilings on top of the declared slots.
**Branch target:** new feat branch off `main`

## Problem

Today the member declares availability as a single number per weekday (`mondayMinutes…sundayMinutes`) plus a global `preferredSessionMinutes`. The scheduler hardcodes a **08:00–22:00 local** window, subtracts Google Calendar busy blocks, and greedily packs chunks from Monday forward.

Three consequences break real members:

1. **Wrong time of day.** A member who only studies 19:00–22:00 keeps getting sessions chucked onto their 08:00 because the window ignores preference.
2. **Fragmentation within a day.** Given slots `08:00–10:00` and `21:00–00:00` and 3h of work, the greedy chooses the earliest interval first (2h in the morning + 1h at night) when the ideal was 3h contiguous at night.
3. **Pileup on Monday.** The scheduler walks days in order, so a week with plenty of slack across Mon–Sun still packs everything on Monday if it fits, leaving Tue–Fri empty. "Distribute evenly across the week" is not an objective today.

This spec resolves all three by (a) letting the member declare **when** they're available with 30-minute granularity, and (b) replacing the greedy with a week-scope solver that optimizes for distribution + consolidation + pedagogical order.

## Goals

1. **Member declares slots per weekday.** Multiple ranges allowed per day (`Ter: 07:00–08:00` + `19:00–22:00`). Granularity = 30 minutes. The scheduler never places sessions outside declared slots.
2. **Per-day minute cap is optional.** `mondayMinutes…sundayMinutes` become nullable ceilings. `null` = "no cap, use the full declared slot time". Non-null = "study at most this much on this day, even if slot space allows more".
3. **Week-level scheduling.** The solver sees all 7 days + all chunks jointly and optimizes a single objective function with explicit weights for `unplaced`, `day imbalance`, `slot count`, `residue-in-big-slot`, `small-slot usage`, `order inversion`, `waste`.
4. **Deterministic, explainable, testable.** Same input always produces same output. Objective function documents the trade-offs. Test cases assert specific expected layouts.
5. **Preserve current behaviour for existing users.** Backfill migration creates a default slot `08:00–22:00` for every `(userId, dayOfWeek)` with `minutes > 0`. Members who never open the new UI get the same scheduler output they had before.

## Non-goals

- **Multiple session-length preferences.** `preferredSessionMinutes` stays a single global number, same as today.
- **Per-item deadlines.** `WeeklyPlanItem` has no `dueAt`; we're not adding one. The admin's `order` field is the only temporal preference, respected as a soft signal.
- **Calendar-aware dragging of slots in the UI.** The UI is a list-of-ranges-per-day with presets, not a weekly grid with drag-to-paint. We'll revisit only if members complain.
- **Automatic slot learning.** The scheduler does not infer "you tend to study at 19:00" from history. Slots are explicit declarations.
- **Non-weekly-recurring availability.** Slots repeat weekly by `dayOfWeek`. One-off exceptions ("I can't study next Thursday") are out of scope — Google Calendar busy handles that case today.

## Decisions (confirmed during brainstorming)

| # | Question | Resolution |
|---|---|---|
| D1 | Are slots the source of truth of when the member studies, with `maxMinutesPerDay` as an optional ceiling? | **Yes.** Slots define *when*; caps define *how much*. `null` cap = budget is the slot total. |
| D2 | What is the UI metaphor? | **List of time ranges per weekday**, with presets ("Noite de semana", "Manhã de fim de semana", "Copiar de Seg para todos"). 30-minute granularity. No drag-to-paint grid. |
| D3 | Schema: new table vs. JSON on `MemberAvailability`? | **New table `AvailabilitySlot`.** Normalized, consistent with existing M2M patterns (`LibraryItemTopic`), easy to validate. |
| D4 | What does "no slots declared for a day" mean? | **Indisponível.** Scheduler does not place anything. Migration backfills `08:00–22:00` for existing users with `minutes > 0` so legacy behaviour is preserved. |
| D5 | What does the scheduler do when a free window is smaller than `preferredSessionMinutes`? | **Rule "iii": respects member's declaration.** If the *slot itself* is < pref (member chose a short slot), it's honored — scheduler places a shorter chunk. If the shortfall comes from a busy block cutting a larger slot, the residue is discarded (not a conscious declaration). Residues are placed only after all pref-sized chunks are placed. |
| D6 | Algorithm: greedy heuristic or exact? | **Heuristic construction + branch-and-bound refinement with a time budget (500 ms).** Always returns a feasible solution from phase 1; phase 2 improves it within the budget. Deterministic. |
| D7 | Per-day or week-level solver? | **Week-level.** Objective function includes a `day_imbalance` term so the solver distributes across days instead of piling on Monday. |
| D8 | Does the admin's `order` matter to the scheduler? | **Soft preference.** `ORDER_VIOLATION_WEIGHT` penalizes inversions (chunk of `order=3` placed before chunk of `order=1` in wall-clock time) but does not prohibit them. |

## Architecture

```
member UI (lista de faixas + presets)
        ▼  PATCH /me/availability
  AvailabilityController → AvailabilityService
        ▼  Prisma
  MemberAvailability (caps per-day, pref, tz)
  AvailabilitySlot  (userId, dayOfWeek 0–6, startMinute, endMinute)
        ▲
        │ on plan publish
        │
  PublicationService.publish
        ▼
  SchedulerService.plan(input)
        ├── phase 1: FFD heuristic construction → S0, C0
        └── phase 2: B&B refinement with 500 ms budget → S*, C*
        ▼
  GoogleCalendarService.createEvent per placement
```

Day-of-week encoding: **ISO 8601, `0 = Monday … 6 = Sunday`** — matches the order of `DAY_MINUTES_KEYS` in `scheduler.service.ts`.

## Data model

### `AvailabilitySlot` (new table)

```prisma
model AvailabilitySlot {
  id          String   @id @default(cuid())
  userId      String
  dayOfWeek   Int      // 0 = Monday, 6 = Sunday
  startMinute Int      // 0..1440, minute-of-local-day (0 = 00:00)
  endMinute   Int      // startMinute+30..1440 (exclusive upper bound; 1440 = midnight)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, dayOfWeek])
}
```

Invariants (enforced at the service layer; DB has no range type, so no CHECK constraint):

- `0 ≤ dayOfWeek ≤ 6`
- `0 ≤ startMinute < endMinute ≤ 1440`
- `(endMinute - startMinute) ≥ 30` — **minimum slot size 30 min**. A slot shorter than 30 min is almost never useful and clutters the solver.
- `startMinute % 30 == 0 && endMinute % 30 == 0` — **granularity 30 min**.
- **No overlap within the same `(userId, dayOfWeek)`** — two slots touching at a boundary (e.g., `08:00–10:00` and `10:00–12:00`) are allowed but merged conceptually; strictly overlapping ranges are rejected.

### `MemberAvailability` (modified)

Change `mondayMinutes…sundayMinutes` from `Int @default(0)` to `Int?` (nullable), keeping the same column names. Semantics shift:

- `null` → **no daily cap**. Effective budget = sum of the day's slots (post-busy).
- Non-null integer → hard ceiling in minutes. Effective budget = `min(sum-of-slots, cap)`.
- The value `0` retains the "don't study this day" meaning, but that's now redundant with "no slots declared". UI should normalize: setting a day to 0 via the cap field clears all slots for that day; removing all slots leaves `null` as cap and the day is simply indisponível.

`preferredSessionMinutes`, `timezone`, `updatedAt`, relations — unchanged.

### Migration `j_availability_slots`

```sql
-- Create the slot table
CREATE TABLE "AvailabilitySlot" (
  "id"          TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "dayOfWeek"   INT  NOT NULL,
  "startMinute" INT  NOT NULL,
  "endMinute"   INT  NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AvailabilitySlot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "AvailabilitySlot_userId_dayOfWeek_idx"
  ON "AvailabilitySlot"("userId", "dayOfWeek");

-- Make per-day cap nullable
ALTER TABLE "MemberAvailability"
  ALTER COLUMN "mondayMinutes"    DROP NOT NULL,
  ALTER COLUMN "tuesdayMinutes"   DROP NOT NULL,
  ALTER COLUMN "wednesdayMinutes" DROP NOT NULL,
  ALTER COLUMN "thursdayMinutes"  DROP NOT NULL,
  ALTER COLUMN "fridayMinutes"    DROP NOT NULL,
  ALTER COLUMN "saturdayMinutes"  DROP NOT NULL,
  ALTER COLUMN "sundayMinutes"    DROP NOT NULL;
-- Do NOT drop defaults; existing rows keep their integers, new rows default to 0
-- which the app will treat as "no slots + no cap = indisponível" until the
-- member opens the new UI.

-- Backfill: for every (userId, dayOfWeek) where the corresponding column > 0,
-- create a default slot 08:00–22:00. Uses a lateral unnest of the seven days.
INSERT INTO "AvailabilitySlot" ("id", "userId", "dayOfWeek", "startMinute", "endMinute", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  m."userId",
  d.day_idx,
  480,   -- 08:00
  1320,  -- 22:00
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

`gen_random_uuid()` is available via `pgcrypto` — verify with `CREATE EXTENSION IF NOT EXISTS pgcrypto;` at the top of the migration if the extension is not already installed. (It likely is, as other tables use `@default(cuid())` at the application layer, but pgcrypto is only needed for this one-shot backfill.) Alternative: generate ids in code and insert through a TypeScript migration script. **Decision: inline SQL with `gen_random_uuid()::text` + explicit `CREATE EXTENSION IF NOT EXISTS pgcrypto`.** The migration runs once per database and the id format difference (UUID vs cuid) is immaterial.

## API

### `GET /me/availability`

Returns the existing `MemberAvailability` row plus a new `slots` array:

```jsonc
{
  "mondayMinutes":    null,          // was: 0
  "tuesdayMinutes":   120,
  // ... remaining day caps (nullable)
  "preferredSessionMinutes": 60,
  "timezone": "America/Sao_Paulo",
  "slots": [
    { "id": "...", "dayOfWeek": 0, "startMinute": 480,  "endMinute": 600  },
    { "id": "...", "dayOfWeek": 0, "startMinute": 1260, "endMinute": 1440 },
    { "id": "...", "dayOfWeek": 1, "startMinute": 1140, "endMinute": 1320 }
  ]
}
```

`slots` is sorted by `(dayOfWeek asc, startMinute asc)` server-side so the UI does not need to sort.

### `PATCH /me/availability`

Accepts the same shape plus optional `slots`:

```jsonc
{
  "mondayMinutes": null,               // explicit null = clear cap
  "preferredSessionMinutes": 60,
  "timezone": "America/Sao_Paulo",
  "slots": [
    { "dayOfWeek": 0, "startMinute": 480,  "endMinute": 600 },
    { "dayOfWeek": 1, "startMinute": 1140, "endMinute": 1320 }
  ]
}
```

Semantics:

- `slots` is **full replacement** per weekday that appears in the payload. Example: if the payload contains any slot with `dayOfWeek == 0`, all existing Monday slots are deleted and the payload's Monday slots are inserted. Weekdays absent from the payload are untouched.
- To clear all slots for a day, send an empty array tagged with that day. Wire format: add a sentinel `clearDays: number[]` alongside `slots`, or require the client to send `slots: [{ dayOfWeek: 0, /* empty marker */ }]`. **Decision: add `clearDays: number[]` to the payload** — cleaner than a sentinel slot.
- Slot validation per `AvailabilitySlot` invariants above; any violation → 400 with `{ error: { code: "BAD_REQUEST", message, details: { field, reason } } }`.
- Full transaction: all slot mutations happen in a single Prisma `$transaction` so a half-applied state cannot leak out.

### Zod schema

```ts
const SlotSchema = z.object({
  dayOfWeek:   z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1410).multipleOf(30),
  endMinute:   z.number().int().min(30).max(1440).multipleOf(30),
}).refine((s) => s.endMinute - s.startMinute >= 30, {
  message: "slot deve ter ao menos 30 minutos",
});

const AvailabilityPatchSchema = z.object({
  mondayMinutes:    z.number().int().min(0).max(24 * 60).nullable().optional(),
  // ... remaining days
  preferredSessionMinutes: z.number().int().min(15).max(240).optional(),
  timezone: z.string().optional(),
  slots:     z.array(SlotSchema).optional(),
  clearDays: z.array(z.number().int().min(0).max(6)).optional(),
});
```

## UI

### Location

Same surface as today: `/me/settings → Availability`. The existing `AvailabilityGrid` component at `apps/web/components/member/availability-grid.tsx` is extended; a new `AvailabilitySlotEditor` is added below the daily cap section.

### Layout (per weekday)

```
┌─ Mon ──────────────────────────────────────── daily cap: [  —  ] ┐
│   08:00  –  10:00    ✕                                            │
│   19:00  –  22:00    ✕                                            │
│   + adicionar faixa                                               │
└───────────────────────────────────────────────────────────────────┘
```

- Each range is two `<select>` elements in 30-min steps (`00:00, 00:30, ..., 23:30, 24:00`). Keyboard-navigable, mobile-friendly, no drag.
- `adicionar faixa` appends a new range defaulting to the last-end-or-`18:00`, `+2h`.
- Remove button (`✕`) deletes the range.
- Daily cap is a small input/select to the right with preset buttons: `—` (null/no cap) · `1h` · `2h` · `3h` · `4h`.
- Visual conflict cue: if a range overlaps another on the same day, both ranges turn `outcome-stuck` and the save button is disabled with a message.

### Presets panel (above the day list)

Three buttons:

- **Noite de semana** — sets Mon–Fri to `19:00–22:00`, Sat–Sun untouched.
- **Manhã de fim de semana** — sets Sat–Sun to `08:00–12:00`.
- **Copiar Seg para todos os dias** — copies whatever Monday currently has (slots + cap) to Tue–Sun.

Each preset **adds**, does not replace, except "Copiar" which is a full override with confirmation.

### Timezone field

Unchanged. Free-text input with `America/Sao_Paulo` default.

### Validation feedback

- Conflict (overlap) — inline red text under the day, save disabled.
- `startMinute >= endMinute` — same.
- Save state: existing `Saved.` / `Failed to save.` messages in `AvailabilityGrid`.

## Scheduler — new behaviour

### Input shape (updated)

```ts
export type SchedulerInput = {
  weekStart: Date;
  availability: {
    slots: AvailabilitySlotInput[];          // NEW
    caps: (number | null)[];                  // NEW — 7-element array, index 0=Mon
    preferredSessionMinutes: number;
    timezone: string;
  };
  busyBlocks: BusyBlock[];
  items: ItemInput[];                         // { id, estimatedMinutes, order }
  now?: Date;
};

export type AvailabilitySlotInput = {
  dayOfWeek:   number;   // 0–6
  startMinute: number;   // minute-of-local-day
  endMinute:   number;
};
```

`items` gains a required `order: number` field (the admin's `WeeklyPlanItem.order`). `PublicationService` already reads this; just pass it through.

### Algorithm

Per-week solver, two phases:

**Phase 1 — FFD heuristic construction (always produces a feasible solution).**

1. Chunk each item into pref-sized pieces plus possibly one tail chunk `< pref` (same as today).
2. Sort chunks by `(size desc, order asc)` — largest first, then pedagogical tiebreak.
3. For each day, compute `effective_intervals` = slots ∩ ¬busy, in local-minute coordinates. Skip intervals that end at or before `now` for the current day.
4. Initialize `dayLoad[0..6] = 0`.
5. For each chunk in sorted order:
   - Rank candidate `(day, interval)` placements by:
     - **a.** `dayLoad[day]` asc — prefer least-loaded day to balance the week.
     - **b.** `|interval_size - chunk_size|` asc — prefer the smallest interval that fits (leave big intervals for pref chunks).
     - **c.** `interval_start` asc — deterministic tiebreak.
   - Apply cap: if `dayLoad[day] + chunk.minutes > cap` and cap is non-null, skip this day.
   - Apply rule iii (usability of interval): each effective interval is tagged with its parent slot's size. An interval is **unusable for any chunk** iff `interval.size < pref` AND the parent `slot.size ≥ pref` — meaning the shortfall came from a busy block, not from the member's declaration. If the slot itself is `< pref`, every residue of it is usable (the slot is the member's conscious choice).
   - Place into best-ranked candidate; advance interval cursor by `chunk.minutes + BUFFER_MINUTES (10)`.
   - If no candidate is found, push to `unplaced`.
6. Output `S0` + compute `C0` via the objective function below.

**Phase 2 — Branch-and-bound refinement (improves within a 500 ms budget).**

1. Initialize `best = S0`, `bestCost = C0`, `deadline = now + 500 ms`.
2. Recurse over chunks in the same sorted order. At each step:
   - Enumerate feasible `(day, interval)` placements for the current chunk (same feasibility rules as phase 1).
   - Explore in rank-order (same criteria) so good solutions are found early.
   - Compute `partialCost` (cost of placements made so far).
   - Compute `lowerBound` = `partialCost + Σ (cheapest achievable cost for remaining chunks)`. A tight lower bound counts only terms that can strictly increase (`UNPLACED`, `SMALL_SLOT`, `RESIDUE_IN_BIG`); it treats `DAY_IMBALANCE` and `SLOT_COUNT` as zero for the bound (they can only go up, so the true cost is ≥ `lowerBound`).
   - **Prune** if `lowerBound ≥ bestCost`.
   - **Timeout**: check `Date.now() < deadline` at every entry; if expired, unwind and return `best`.
3. When all chunks are placed (or marked unplaced), if `cost < bestCost`, update `best`.
4. Return `best`.

Determinism: iteration order is fully specified, no randomness, no parallelism. Two invocations with identical input always return identical output. Timeout budget is wall-clock time, which could in theory produce different results on slower hardware — we mitigate by also capping `nodesExplored ≤ 50_000` as a secondary bound. Either limit hitting returns the current best.

### Objective function

```
cost =   UNPLACED_PENALTY        × Σ minutes_unplaced
       + DAY_IMBALANCE_WEIGHT    × Σ max(0, dayLoad[d] - mean_load)
       + SLOT_COUNT_WEIGHT       × |{ (day, interval) : touched }|
       + RESIDUE_IN_BIG_WEIGHT   × Σ minutes_of_residue_chunks_in_slots_≥_pref
       + SMALL_SLOT_WEIGHT       × Σ minutes_placed_in_slots_<_pref
       + ORDER_VIOLATION_WEIGHT  × |{ (a, b) : a.order < b.order ∧ a.scheduledAt > b.scheduledAt }|
       + WASTE_WEIGHT            × Σ unused_minutes_in_touched_intervals
```

Weights (lexicographic — each tier dominates the sum of all lower tiers at realistic instance sizes):

| Constant | Value |
|---|---|
| `UNPLACED_PENALTY`       | 100_000 |
| `DAY_IMBALANCE_WEIGHT`   |   1_000 |
| `SLOT_COUNT_WEIGHT`      |     100 |
| `RESIDUE_IN_BIG_WEIGHT`  |      50 |
| `SMALL_SLOT_WEIGHT`      |      20 |
| `ORDER_VIOLATION_WEIGHT` |       5 |
| `WASTE_WEIGHT`           |       1 |

These are tuned for typical instances (≤20 chunks, ≤30 intervals/week). If someone has 200 chunks, the lower tiers start to rival upper tiers numerically — a non-issue at our program's scale.

### Interactions to note

- **Imbalance vs consolidation.** Slots `[2h, 3h]` with 3h work: single-day instance → imbalance term is 0 (only one day has capacity), so `SLOT_COUNT` dominates → result fits in the single 3h slot (S2). Week-scope instance: 3h of work, same slots on Mon, plus empty slots on Tue/Wed — imbalance pushes the solver to spread, but `SLOT_COUNT` resists. With the weights above (1000 vs 100), imbalance wins and spreads. This is the intended behaviour: "don't marathon Monday when the week has room".
- **Order as soft preference.** Weight 5 means it's a tiebreaker, not a constraint. If the admin orders items A=1, B=2 but B is smaller and fits a leftover Monday morning slot, the solver may place B before A if the other gains (slot count, balance) exceed `5 × 1 inversion`.
- **Rule iii.** Enforced during feasibility, not objective. A busy-residue placement for a `< pref` chunk is rejected outright in the candidate enumeration. A slot-that-happens-to-be-`< pref` is accepted as a normal placement (member's conscious choice) and only contributes to `SMALL_SLOT_WEIGHT` in the cost.

### Fallback

If phase 2 hits `nodesExplored >= 50_000` or the 500 ms deadline without improving on `S0`, return `S0` with `solver.timeout = true` in the log. Phase 1 is a complete algorithm — always feasible (unplaced chunks go to `overflow`), so we never return a malformed plan.

## Removed / changed code

### `apps/api/src/scheduler/scheduler.service.ts`

- Remove `DAY_START_MINUTE = 8 * 60` and `DAY_END_MINUTE = 22 * 60` constants. The day window is now defined by the member's slots.
- Replace `buildDayState` with `buildDayIntervals(slots, busy, now, tz)` returning the effective-free intervals array (no cursor, no declared-budget concept inside — that's now an objective-function concern, not an invariant).
- Replace the current nested `for chunk in chunks / for day in 7` loop with calls to `phase1FFD(...)` and `phase2BranchAndBound(...)`, both living in the same file.
- Keep `localMinuteToUtc` and `localToUtc` and `getTzOffsetMinutes` — unchanged utilities.
- Keep `BUFFER_MINUTES = 10` and `ROUND_TO_MINUTES = 15` — still used for inter-chunk spacing and "ceil now to next 15" on the current day.

### `apps/api/src/availability/availability.service.ts` + `.controller.ts`

- `AvailabilityInput` becomes `AvailabilityPatchInput` with the new nullable caps + optional `slots`, `clearDays`.
- New helper `replaceSlots(userId, slots, clearDays)` inside `AvailabilityService`, runs inside the same `$transaction` as the `MemberAvailability` upsert.
- Validation: slot overlap detection + 30-min granularity checks before the Prisma call. Throw `BadRequestException` with structured details on violation.
- Returned shape gains a `slots` array, sorted.

### `apps/api/src/weekly-plans/publication.service.ts`

- When calling the scheduler, pass `availability.slots` + `caps` in addition to `preferredSessionMinutes` and `timezone`. The `caps` array is built from `[mondayMinutes, ..., sundayMinutes]` with `null` preserved.
- `items` gains `order` in the scheduler input (already on `WeeklyPlanItem`).
- No other changes — `PlanOverflowError` handling stays.

### `apps/web/components/member/availability-grid.tsx`

- Split into two sections: the existing daily-minutes section (repurposed as "daily cap, optional") and the new `AvailabilitySlotEditor`.
- New component `apps/web/components/member/availability-slots.tsx`.
- New presets module alongside: `apps/web/components/member/availability-slot-presets.tsx`.
- `lib/queries/me-settings.ts` — extend `AvailabilityResponse` type with `slots`, update the mutation payload shape to include `slots` and `clearDays`.

## Error cases

- **Empty slots + non-null cap**: save allowed, but UI shows a neutral hint "sem faixas = sem estudo nesse dia". No error.
- **Overlap within same day**: 400 with `{ code: BAD_REQUEST, details: { field: "slots", reason: "overlap", dayOfWeek: N } }`.
- **Non-30min-boundary start/end**: 400 with `reason: "granularity"`.
- **Slot shorter than 30 min**: 400 with `reason: "too_short"`.
- **Invalid timezone string**: existing behaviour — stored as-is; scheduler throws `RangeError` from `Intl.DateTimeFormat` on first calendar query. Out of scope for this spec; valid tz validation is a separate cleanup.
- **Scheduler solver timeout without improvement**: phase 1 output is returned; a `solver.timeout=true` entry is added to the log. Member sees a valid plan; admin log shows the flag.

## Observability

- `SchedulerService.plan` returns `{ sessions, overflow, diagnostics }`. The new `diagnostics` field contains `{ phase1Cost, finalCost, nodesExplored, timedOut, durationMs }`. `PublicationService` logs diagnostics at `info` level (one line per publish).
- No user-facing analytics — members don't see the solver cost.

## Testing

New/updated test files:

- `apps/api/src/scheduler/scheduler.service.spec.ts` — extend with the cases below, keep the old cases passing (after adapting input shape).
- `apps/api/src/availability/availability.service.spec.ts` — extend with slot upsert + clearDays + overlap detection cases.
- `apps/api/test/availability.e2e-spec.ts` — new e2e covering `PATCH /me/availability` with slots, including 400 on overlap.

### Scheduler canonical cases (all must pass)

1. **Single day, two slots, consolidates into larger.** Slots Mon `[08–10, 21–00]`, pref=60, work=3h across 3 items. Expected: all 3 sessions in the 21:00–00:00 slot.
2. **Week with plenty of slack distributes evenly.** 3h of work, slots Mon–Fri 19:00–22:00, no cap. Expected: ~36 min on each of 5 days (rounded to pref-chunks).
3. **Cap overrides slot capacity.** Slots Mon 19:00–22:00 (3h), `mondayMinutes=60`, work=90min. Expected: 60min placed on Monday, 30min overflow (if no other day has a slot) or spread to another day.
4. **Busy block cuts a slot.** Slot Mon 19:00–22:00, busy 20:00–20:30, pref=60, work=2h. Expected: one 60min chunk 19:00–20:00, one 60min chunk 20:40–21:40 (20:30 + 10min buffer). A 20min residue would not be used.
5. **Short slot is honored.** Slot Ter 19:00–19:30 (30min only), pref=60, work=30min. Expected: 30min chunk at 19:00, despite pref=60. (Member's declaration respected.)
6. **Order as soft preference.** Two items, A (order=1, 60min) and B (order=2, 60min). Slot Mon 19:00–22:00. Expected: A scheduled at 19:00, B at 20:10.
7. **No slots on a day**. `MemberAvailability.mondayMinutes=0`, no slots declared for Monday. Expected: nothing scheduled on Monday, work distributes to other days (or overflows).
8. **Legacy user (post-migration).** Member row with old minutes `[60,60,0,0,0,0,0]` and backfilled slots `[Mon 08–22, Tue 08–22]`. Expected: scheduler produces output equivalent to the old behaviour for a typical week (verified by seeding a test DB state identical to a pre-migration snapshot and diffing the scheduler output).
9. **Solver timeout fallback.** Construct a patological input with 50 chunks + 30 intervals and a tiny budget (5 ms). Expected: returns phase-1 output, `diagnostics.timedOut = true`.
10. **Determinism.** Run any of the above twice with the same input; outputs are byte-equal.

### Availability service cases

- PATCH with `slots: [Mon 08–10]` + `clearDays: [1]` clears Tuesday, replaces Monday, leaves Wed–Sun slots intact.
- PATCH with overlapping slots for the same day → 400 with `reason: "overlap"`.
- PATCH with `endMinute < startMinute + 30` → 400 with `reason: "too_short"`.
- PATCH with `startMinute = 475` → 400 with `reason: "granularity"`.
- `mondayMinutes: null` in payload → column set to NULL; subsequent GET returns `null`.

### E2E (Playwright)

- New spec `tests/availability-slots.spec.ts`: member logs in, navigates to `/me/settings`, adds two slots for Monday (08:00–10:00 and 19:00–22:00) via the preset + manual path, saves, reloads, slots persist, overlap attempt blocks save.

## Rollout

1. Ship migration + API + UI in one PR (single feat branch). Migration is backwards-compatible (nullable caps + new table). Old API clients keep working because the new fields are optional.
2. After merge to `main`, Docker entrypoint runs `prisma migrate deploy` on container start → backfill runs automatically.
3. No feature flag. The new scheduler is the only scheduler after the PR lands; existing members keep their backfilled `08:00–22:00` slots until they open the UI.
4. Monitor solver diagnostics for the first week — `timedOut` should be effectively 0% at our scale. If it spikes, lower the `nodesExplored` cap or tune weights.

## Out of scope follow-ups

- **Validate `timezone` string** against the IANA list at write time.
- **Per-item deadlines** to give the admin a hard "this must be done by Wed" knob.
- **Weekly drag-to-paint grid UI**, if the list-of-ranges feels too tedious after real use.
- **Solver visualizer** in the admin plan editor — show the cost breakdown next to the draft so the admin understands why a plan looks the way it does.
