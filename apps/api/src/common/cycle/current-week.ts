/**
 * Whether `now` falls inside a plan's own week window [weekStart, weekEnd].
 *
 * Members may only VIEW and ACT ON items in their CURRENT week. Past (closed)
 * and future weeks are blocked at the service layer so a member can't reach a
 * stale carried-over copy from an old week — e.g. via the calendar history,
 * which exposes past events' `ICS ID: planId/itemId` markers — and back-mark it
 * weeks later. The correct place to finish a still-pending carried item is its
 * current-week copy, which carry-over re-creates each week.
 */
export function isPlanWeekCurrent(weekStart: Date, weekEnd: Date, now: Date): boolean {
  return now.getTime() >= weekStart.getTime() && now.getTime() <= weekEnd.getTime();
}
