import { bucketPerWeekForTest } from './cockpit.service.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

describe('bucketPerWeek credits the first completion week only', () => {
  const cycleStart = new Date('2026-05-04T00:00:00Z');
  const week = (i: number) => new Date(cycleStart.getTime() + i * WEEK_MS);

  const item = (libraryItemId: string, outcome: any, completedAt: string | null) => ({
    libraryItemId,
    outcome,
    completedAt: completedAt ? new Date(completedAt) : null,
    scheduledMinutes: 30,
    actualMinutes: null,
  });
  const plan = (i: number, items: any[]) => ({
    id: `p${i}`,
    weekStart: week(i),
    publishedAt: null,
    items,
  });

  it('a material carried + done in 3 weeks counts once, in its first completion week', () => {
    const plans = [
      plan(0, [item('A', 'DONE_EASY', '2026-05-06T00:00:00Z')]),
      plan(1, [item('A', 'DONE_EASY', '2026-05-13T00:00:00Z')]),
      plan(2, [item('A', 'DONE_EASY', '2026-05-20T00:00:00Z')]),
    ];
    const buckets = bucketPerWeekForTest(plans as any, 3, cycleStart);
    expect(buckets[0]!.byOutcome.DONE_EASY).toBe(1);
    expect(buckets[1]!.byOutcome.DONE_EASY).toBe(0);
    expect(buckets[2]!.byOutcome.DONE_EASY).toBe(0);
  });

  it('distinct materials each count in their own week', () => {
    const plans = [
      plan(0, [item('A', 'DONE_EASY', '2026-05-06T00:00:00Z'), item('B', 'DONE_HARD', '2026-05-07T00:00:00Z')]),
      plan(1, [item('A', 'DONE_EASY', '2026-05-13T00:00:00Z'), item('C', 'DOUBTS', '2026-05-14T00:00:00Z')]),
    ];
    const buckets = bucketPerWeekForTest(plans as any, 2, cycleStart);
    expect(buckets[0]!.byOutcome.DONE_EASY).toBe(1);
    expect(buckets[0]!.byOutcome.DONE_HARD).toBe(1);
    expect(buckets[1]!.byOutcome.DOUBTS).toBe(1);
    expect(buckets[1]!.byOutcome.DONE_EASY).toBe(0); // A already credited to week 0
  });

  it('a stuck-then-done material is credited to the week it was actually done', () => {
    const plans = [
      plan(0, [item('A', 'STUCK', '2026-05-06T00:00:00Z')]),
      plan(1, [item('A', 'DONE_EASY', '2026-05-13T00:00:00Z')]),
    ];
    const buckets = bucketPerWeekForTest(plans as any, 2, cycleStart);
    expect(buckets[0]!.byOutcome.STUCK).toBe(0);
    expect(buckets[1]!.byOutcome.DONE_EASY).toBe(1);
  });
});
