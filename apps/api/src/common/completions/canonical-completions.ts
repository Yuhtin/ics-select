import { isPositiveOutcome, type ItemOutcome } from '@ics-select/shared';

/**
 * Minimum shape needed to dedupe carried-over completions. A study material
 * (`libraryItemId`) can appear as many `WeeklyPlanItem` rows across weeks
 * because carry-over re-seeds unfinished items each week; only one of those
 * rows should count toward cross-cycle aggregates.
 */
export interface CompletionRow {
  libraryItemId: string;
  outcome: ItemOutcome;
  completedAt: Date | null;
}

function earlier(a: Date | null, b: Date | null): boolean {
  // Returns true if `a` is strictly earlier than `b`. NULL completedAt sorts
  // last (a real timestamp always wins over a missing one).
  const at = a?.getTime() ?? Number.POSITIVE_INFINITY;
  const bt = b?.getTime() ?? Number.POSITIVE_INFINITY;
  return at < bt;
}

/**
 * Per `libraryItemId`, returns the single "canonical" completion for a member.
 *
 * Selection rule (faithful to the product choice "credited to the earliest
 * week it was *positively* completed"):
 *   1. Prefer the earliest row with a POSITIVE outcome (`isPositiveOutcome`).
 *   2. If the material was never positive, fall back to the earliest non-PENDING
 *      row (e.g. only STUCK) so it still counts toward "any non-PENDING" tallies.
 * Materials with only PENDING rows are dropped (no completion).
 *
 * Extra fields on the input rows (weekStart, minutes, topicIds, a `ref` back to
 * the original row, …) are preserved on the returned canonical row so callers
 * can bucket by first-completion week or sum minutes without a second lookup.
 *
 * Apply at every CROSS-CYCLE counting site so a material carried across N weeks
 * and marked done in each counts once.
 */
export function canonicalCompletions<T extends CompletionRow>(rows: readonly T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    if (r.outcome === 'PENDING') continue;
    const cur = best.get(r.libraryItemId);
    if (!cur) {
      best.set(r.libraryItemId, r);
      continue;
    }
    const rPos = isPositiveOutcome(r.outcome);
    const curPos = isPositiveOutcome(cur.outcome);
    // A positive row always beats a non-positive one. Within the same
    // positivity class, the earlier completedAt wins.
    if (rPos && !curPos) {
      best.set(r.libraryItemId, r);
    } else if (rPos === curPos && earlier(r.completedAt, cur.completedAt)) {
      best.set(r.libraryItemId, r);
    }
  }
  return [...best.values()];
}

/** Count of distinct materials with ANY non-PENDING outcome (cohort-rank "itemsDone"). */
export function countCanonicalDone(rows: readonly CompletionRow[]): number {
  return canonicalCompletions(rows).length;
}

/** Count of distinct materials whose canonical completion is positive (`isPositiveOutcome`). */
export function countCanonicalPositive(rows: readonly CompletionRow[]): number {
  return canonicalCompletions(rows).filter((r) => isPositiveOutcome(r.outcome)).length;
}
