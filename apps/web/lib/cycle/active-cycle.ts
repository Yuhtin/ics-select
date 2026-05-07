import type { CycleRow } from '../queries/admin-cycles';

/**
 * Client-side mirror of `resolveActiveCycle` in
 * apps/api/src/common/cycle/active-cycle.ts. The admin UI must see the same
 * cycle the backend treats as active, so both helpers apply the same rule:
 *
 *   1. ACTIVE cycles containing `now` win. When multiple overlap, the one
 *      with the most memberships is the "primary" (so a satellite cycle
 *      like Bench doesn't outrank the main cohort). Earlier startsAt is the
 *      tiebreaker.
 *   2. Otherwise, the ACTIVE cycle with the earliest `startsAt > now` (the
 *      nearest upcoming cycle).
 *   3. ARCHIVED cycles are never returned. If nothing qualifies, null.
 *
 * A naive `cycles.find(c => c.status === 'ACTIVE')` is wrong and regresses in
 * the window between two back-to-back cycles — CLAUDE.md calls this out.
 */
function membershipCount(c: CycleRow): number {
  return c._count?.memberships ?? c.memberships?.length ?? 0;
}

export function resolveActiveCycleId(
  cycles: CycleRow[] | undefined | null,
  now: Date = new Date(),
): string | null {
  if (!cycles || cycles.length === 0) return null;
  const nowMs = now.getTime();
  const activeCandidates = cycles.filter((c) => c.status === 'ACTIVE');

  const contains = activeCandidates.filter((c) => {
    const start = new Date(c.startsAt).getTime();
    const end = new Date(c.endsAt).getTime();
    return start <= nowMs && nowMs <= end;
  });
  if (contains.length > 0) {
    contains.sort((a, b) => {
      const sizeDiff = membershipCount(b) - membershipCount(a);
      if (sizeDiff !== 0) return sizeDiff;
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    });
    return contains[0]!.id;
  }

  const upcoming = activeCandidates.filter(
    (c) => new Date(c.startsAt).getTime() > nowMs,
  );
  if (upcoming.length === 0) return null;
  upcoming.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  return upcoming[0]!.id;
}
