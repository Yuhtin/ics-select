# Ranking redesign — member spotlight + admin engagement ranking

**Date:** 2026-05-04
**Status:** Spec
**Surfaces:** `/me/cohort` (member), `/admin/cycle/[id]` (admin)

## Context

Today the cohort page (`/me/cohort`) shows a numbered ranking of every member with their week completion percentage and a progress bar. The page renders Activity feed first, then the ranking below it. Two problems:

1. **Position.** The ranking is the social-pressure surface; today it sits below the activity feed where it gets buried.
2. **Metric.** Current ranking is `done / total` for the current week only. This punishes members with bigger plans (they need more raw work to hit 100%), rewards members with tiny plans (anyone with one item closes 100% trivially), and resets every Monday — a member who studied hard last week and took a recovery day this week disappears from the top, killing the narrative of consistency the program wants to celebrate.

There is also no admin-facing ranking. The admin can read the engagement score (0–100) per member from the individual cockpit, but cannot see the cohort sorted by engagement at a glance. The cycle overview shows a member grid (alphabetical), a heatmap (chronological), and an activity feed — none of which surfaces "who is doing well overall in this cycle".

The product intent for the member ranking, from the user: **show who is putting in effort, and make it look like many people are putting in effort, so the member who isn't studying feels social pressure to start — without crushing late starters or members with low availability.**

The product intent for the admin ranking: **comparative cohort view ordered by the existing engagement score**, displayed as a dense table the admin reads in one pass.

## Goals

- Move the member ranking above Activity on `/me/cohort`.
- Replace the percentage-based week ranking with a ciclo-aware metric that doesn't depend on plan size, doesn't punish low availability, and rewards consistent appearance over weekend marathons.
- Hide raw scores from members. The metric is internal; the surface only celebrates the top three.
- Add a new admin-only ranking on `/admin/cycle/[id]`, below the cohort heatmap, sorted by the existing engagement score (0–100) with a per-criterion breakdown visible in-row.

## Non-goals

- No new fórmula for the engagement score. The admin ranking reuses `computeEngagementScore` exactly as it exists today. The internal `cohortRankFromBottom` component keeps using raw `done` count (not the new member-ranking points formula); engagement score and member ranking serve different intents and stay decoupled.
- No DB migration. Both rankings derive from existing `WeeklyPlanItem` + `WeeklyRetro` + `Cycle` data.
- No mobile-responsive admin table. Admin surfaces are desktop-first per the design system; table renders horizontally only.
- No reorder of `CycleMembersGrid`. The avatar grid keeps its current order.
- No telemetry / analytics. Project doesn't instrument page sections today and this isn't the moment to start.
- No score history per week in the admin ranking row. The cockpit individual page already exposes `scoreByWeek` for who needs the trend.
- No AI consumer changes. `draft-plan` / `diagnose` / `chat` don't read the ranking.

## Member ranking

### Surface

`/me/cohort` reorders sections: spotlight first, then Activity feed, then the cohort roster aside (unchanged). The numbered ranking with progress bars is replaced by a top-3 spotlight; positions 4–N never appear as a numbered list.

```
Header (Cohort · cycle name + count)
├── Spotlight ("On fire")           ← NEW, above Activity
├── Activity · last 7d              ← was first
└── (aside) Cohort roster           ← unchanged
```

### Score (internal, not exibido)

Hybrid score combining cycle accumulation with current-week boost:

```
score_total = pontos_ciclo + 2 × pontos_semana_atual

pontos = Σ(estimatedMinutes × peso_outcome)
       + 20 × |dias_distintos_UTC_com_outcome_positivo|

peso = {
  DONE_EASY: 1.0
  DONE_HARD: 1.2
  DOUBTS:    1.0
  SKIPPED:   0.3
  STUCK:     0
  PENDING:   0
}
```

- `pontos_ciclo`: every `WeeklyPlanItem` in `PUBLISHED` plans of the user where `weekStart >= cycle.startsAt` and `weekStart <= now`.
- `pontos_semana_atual`: items completed inside the current week (Mon 00:00 UTC → Sun 23:59 UTC, anchored on `now` via `mondayUTC`, same helper used today). The current week contributes to both terms — a positive item this week shows up in `pontos_ciclo` and again (×2) in `pontos_semana_atual`. Net effect: the current week weights ~3× as much as a past week, creating natural "act now" pressure without a hard reset.
- "Outcome positivo" = `isPositiveOutcome(outcome)` from `@ics-select/shared` (DONE_EASY, DONE_HARD, DOUBTS, SKIPPED). STUCK and PENDING contribute 0.
- "Dia com outcome positivo" = UTC date of `completedAt`. Two items completed in the same UTC day count as one day for the consistência bonus.
- `SKIPPED` weights 0.3 to discourage marking everything `SKIPPED` to game the ranking, while still recognizing that the admin allowed the option intentionally for material the member already knew.

### Tie-break

Ordered by:

1. `score_total` desc.
2. `pontos_consistencia` desc (favor habit over volume).
3. `pontos_semana_atual` desc (favor recent activity).
4. `name` asc (Pt-BR locale, sensitivity base) — neutral final tiebreaker.

Stable across reloads.

### Edge cases

- **No items completed in cycle.** `score = 0`. Member never enters the spotlight (top-3 entries require `score > 0`).
- **Cohort com fewer than 3 engaged members.** Spotlight shows only members with `score > 0`. If 1 or 2 members qualify, only those cards render.
- **No member with `score > 0`.** Spotlight section unmounts entirely (no eyebrow, no empty-state text). The page header is followed directly by Activity.
- **Member joined mid-cycle.** No special treatment. The 2× current-week boost naturally lifts new members who are active right now; nobody is punished for past inactivity that pre-dated their membership.
- **Plan in DRAFT, ARCHIVED, or otherwise non-PUBLISHED status.** Excluded from cálculo (already filtered today).
- **Item completed before `cycle.startsAt`.** Filtered out by the `weekStart >= cycle.startsAt` constraint.

### Ranking visibility gate

Continues to honor `cycle.rankingVisibleToMembers`. When `false`, `ranking` is `undefined` in the response, and the spotlight section does not render — Activity becomes the first thing under the header. Same gating model as today; admin toggle in `RankingToggle` unchanged.

### Backend shape

`CohortResponse.ranking` changes meaning. Today:

```ts
ranking?: Array<{
  userId; name; pictureUrl; percent; done; total; isMe;
}>;
```

After this redesign:

```ts
ranking?: Array<{
  userId: string;
  name: string;
  pictureUrl: string | null;
  score: number;       // raw score, used by client only for dot intensity vs top1
  isMe: boolean;
}>;
```

`percent`, `done`, `total` are removed — no surface consumes them anymore. The score is sent so the client can compute relative dot intensity (top1 = baseline 100%, others scaled to it). Members never see the number; it is only used to drive the visual representation.

The array contains **at most 3 entries** — the top 3 by tie-break rules, restricted to members with `score > 0`. Positions 4–N never leave the server; this preserves the "no exposed tail" intent against client-side inspection (DevTools, network tab). If fewer than 3 members have `score > 0`, the array contains 0–2 entries.

### UI

Component: `apps/web/components/member/cohort-spotlight.tsx` (novo). Replaces `cohort-ranking.tsx` (delete after migration).

Layout:

```
ON FIRE
┌────────┐    ┌────────┐    ┌────────┐
│ avatar │    │ avatar │    │ avatar │
│ Maria  │    │ João   │    │ Ana    │
│ ●●●    │    │ ●●○    │    │ ●●○    │
└────────┘    └────────┘    └────────┘
```

- **Eyebrow:** "On fire", styled via `<SectionLabel>` (existing component).
- **Card:** `border border-rule rounded-card p-4`, foto circular 48px, nome in `font-serif text-base font-medium`, three dots indicating intensity.
- **Dots:** filled `text-focus`, empty `text-rule`. Top 1 always renders `●●●`. Others scale to `score / score_top1`:
  - `≥ 0.66 → ●●●`
  - `≥ 0.33 → ●●○`
  - `< 0.33 → ●○○`
- **Self-highlight:** if `isMe === true`, card receives `border-ink` (instead of `border-rule`) and an inline `<span className="text-ink-mute">(you)</span>` after the name.
- **Layout:** desktop ≥ md → `grid grid-cols-3 gap-4`. Mobile → stacked vertically, same card height.
- **Loading state:** three skeleton cards (`bg-paper-warm`) while query resolves.
- **Empty state:** when `ranking` is `undefined` (toggle off) OR no member has `score > 0`, the entire section returns `null`. No eyebrow, no fallback copy.

Consumed by `apps/web/app/(member)/me/cohort/page.tsx`:

```tsx
{hasRanking && (
  <section>
    <CohortSpotlight ranking={data.ranking!} />
  </section>
)}

<section className="space-y-4">
  <SectionLabel>Activity · last 7d</SectionLabel>
  <CohortFeed feed={data.feed} />
</section>
```

(Spotlight is conditional; Activity is always rendered.)

## Admin ranking

### Surface

`/admin/cycle/[id]`. New section in `cycle-overview-view.tsx`, inside the same `<div className="min-w-0 space-y-10">` that contains Triage and the Cohort heatmap, **directly below** the heatmap block. Not on the aside (Activity stays alone there).

```
... (header)
... (Members grid)
<section grid-cols-[1fr_320px]>
  <div>
    Triage
    Cohort heatmap · all weeks
    Engagement ranking         ← NEW
  </div>
  <aside>
    Activity · last 7d
  </aside>
</section>
... (Classes section)
```

### Score

Reuses `computeEngagementScore` from `apps/api/src/admin/cockpit/engagement-score.ts` exactly as today. 0–100, six criteria:

| Criterion | Max |
|---|---|
| Cohort rank | 25 |
| Days active | 20 |
| Plan completion (with cohort-median normalizer) | 20 |
| Retros submitted | 15 |
| Time to first view (TTFV) | 10 |
| Recency | 10 |

Same inputs as `CockpitService.getCockpit` produces per member, but computed in batch over the full cohort once per request.

### Tie-break

1. `score` desc.
2. `cohortPts` desc (already a comparative metric, makes the sort stable across cohorts of similar averages).
3. `name` asc (Pt-BR, sensitivity base).

### Backend shape

`CycleOverviewResponse` adds:

```ts
ranking: Array<{
  userId: string;
  name: string;
  pictureUrl: string | null;
  score: number;                        // 0–100
  breakdown: ScoreBreakdownEntry[];     // 6 entries, each { label, value, weight, status }
  hasAlert: boolean;                    // mirrors members[].hasAlert (STUCK proxy)
}>;
```

`ScoreBreakdownEntry` is the existing type from `engagement-score.ts`.

### Service work

New helper `apps/api/src/admin/cockpit/engagement-inputs.ts`:

```ts
export async function computeEngagementInputsForCohort(
  prisma: PrismaService,
  userIds: string[],
  cycle: Cycle,
  now: Date,
): Promise<Map<string, EngagementInput>>;
```

Extracts the input-building logic that today lives inside `CockpitService.getCockpit` (lines ~150–200 build the per-member inputs; lines ~700–760 replicate similar work for cohort medians). Both call sites refactor to consume the helper. Runs the heavy queries (recent items, retros, plans, sessions, TTFV) once per cohort instead of N times.

`CycleOverviewService.getOverview` adds `computeEngagementRanking(cycleId, now)` step that:

1. Calls `computeEngagementInputsForCohort` for the cycle's user IDs.
2. Iterates each user, calls `computeEngagementScore(input)`.
3. Sorts by tie-break rules.
4. Joins `hasAlert` from the existing `membersWithStuck` set already computed in `getOverview`.
5. Returns the `ranking` array. No row cap — admin needs the full sala.

`CockpitService.getCockpit` refactored to use `computeEngagementInputsForCohort` (passing only the single member's id) so the input math has one source of truth. External response shape unchanged; existing tests pass without modification.

### UI

Component: `apps/web/components/admin/engagement-ranking-table.tsx` (novo).

```
##  MEMBER              SCORE   COHORT  ACTIVE  COMPL  RETRO  TTFV  RECEN
01  Maria Silva          87/100   24      18      18     12     8     7    ⚠
02  João Santos          74/100   20      16      14     10     8     6
03  Ana Pereira          68/100   18      14      14     10     6     6
...
```

- Container: `<div className="space-y-3"><SectionLabel>Engagement ranking</SectionLabel><EngagementRankingTable .../></div>`.
- Table: `font-serif-tool tabular-nums`, `divide-y divide-rule`, header row `border-b-2 border-ink`.
- Column `##`: position (`01`, `02`, ...), `font-mono text-ink-mute text-xs`.
- Column `MEMBER`: 24px circular photo + name in `font-serif text-sm font-medium`, link to `/admin/member/[userId]`.
- Column `SCORE`: `87/100` in mono, color via `statusFor` thresholds (re-exported from `engagement-score.ts`):
  - `≥ 66` → `text-done-easy` (green-ish, "ok")
  - `33–65` → `text-done-hard` (amber, "warn")
  - `< 33` → `text-stuck` (red, "bad")
- Six breakdown columns: numeric `value` from `breakdown[i]`, `font-mono tabular-nums text-ink-soft text-sm`. Headers are uppercase mono (`text-[10px] tracking-eyebrow text-ink-mute`).
- Trailing `⚠` cell when `hasAlert === true`, color `text-stuck`. Empty otherwise.
- Row hover: `hover:bg-paper-warm`, cursor pointer (whole row is a link via Next `<Link>`).
- Empty state: when `ranking.length === 0` (cycle has no members or no `PUBLISHED` plans yet), entire section unmounts.

No expand / collapse. The breakdown is visible in-row. Members who need a deeper trace go to the cockpit individual via the row link.

## Refactoring

The work this design implies, called out explicitly so it isn't done as a surprise:

1. **Extract `engagement-inputs.ts`** from `CockpitService.getCockpit`. The current per-member input construction and cohort-median construction share enough logic that pulling them apart will leave both call sites cleaner. Single-member cockpit and cohort ranking both consume the helper.
2. **`CohortService.getCohort`** replaces the `byUser` percentage tally with `computeMemberRanking(prisma, cycle, userIds, now)`. Drops `MemberRank.percent`, `done`, `total` from the response (no consumer left after the spotlight migration).
3. **`CycleOverviewService.getOverview`** adds `ranking` to its response.
4. **Delete `apps/web/components/member/cohort-ranking.tsx`** after `cohort-spotlight.tsx` is in place. No other component imports it.

External API surface (REST endpoints, Nest modules) unchanged. Type changes ride on existing `lib/queries/me-cohort.ts` and `lib/queries/admin-cycle.ts`.

## Testing

### Backend

- `cohort.service.spec.ts` — new cases:
  - Pontos formula with single outcome (each weight produces expected pontos).
  - Cycle vs current-week separation (item completed last week counts 1×; item completed this week counts 3× in score_total).
  - Consistência bonus: 1 day × 5h vs 5 days × 1h, the 5-day distribution wins.
  - Tie-break order: equal score → consistency → current-week → name.
  - Gating: `rankingVisibleToMembers = false` → `ranking` is undefined.
  - Empty state: cohort with no positive outcomes (toggle on) → `ranking` is empty array.
  - Top-3 cap: cohort with 5+ engaged members → `ranking.length === 3`.
  - Sub-3 case: cohort with only 2 members having `score > 0` → `ranking.length === 2`.
  - SKIPPED weighting: all-SKIPPED member ranks below all-DONE_EASY member with same minutes.

- `cycle-overview.service.spec.ts` — new cases:
  - Ranking present, ordered by score desc.
  - Each row has 6-entry breakdown.
  - `hasAlert` propagated correctly when member has STUCK in window.
  - Empty cohort returns empty `ranking` array.

- `engagement-inputs.spec.ts` (novo) — covers the extracted helper:
  - Single user, returns one-entry map.
  - Cohort of N, returns N-entry map.
  - Empty cohort returns empty map.
  - Cohort medians match what `CockpitService` would compute on its own.

- `cockpit.service.spec.ts` — verify the refactor: response shape regression check, scores match pre-refactor outputs for fixture data.

### Frontend

- Playwright snapshot updates for `/me/cohort` and `/admin/cycle/[id]`. New snapshots:
  - Spotlight with 3 members (top1 has `●●●`, others vary).
  - Spotlight with self in top 3 (border-ink).
  - Spotlight empty (toggle off → section absent).
  - Admin ranking table populated, with at least one `hasAlert` row.
- Unit testing not added (project pattern is Playwright for web; no React Testing Library).

## Open questions

None at the time of writing. All decisions resolved in brainstorming:

- Score visible to members? **No** — internal only.
- Avoid penalizing low availability? **Yes** — minutes consumed (no plan-size denominator) + consistência bonus.
- Member ranking surface? **Top 3 spotlight** above Activity; no numbered tail.
- Admin ranking score? **Reuse engagement-score 0–100**, no new formula.
- Admin ranking surface? **Below cohort heatmap**, dense table with breakdown in-row.
