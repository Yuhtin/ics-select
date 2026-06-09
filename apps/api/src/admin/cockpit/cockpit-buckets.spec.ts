import { bucketPerWeekForTest } from './cockpit.service.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

describe('bucketPerWeek credits by the week the work was actually done (completedAt)', () => {
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

  it('an item planned in week 0 but completed in week 2 counts in week 2 (completedAt, not plan week)', () => {
    const plans = [plan(0, [item('A', 'DONE_EASY', '2026-05-20T00:00:00Z')])]; // 05-20 → week 2
    const buckets = bucketPerWeekForTest(plans as any, 3, cycleStart);
    expect(buckets[0]!.byOutcome.DONE_EASY).toBe(0);
    expect(buckets[2]!.byOutcome.DONE_EASY).toBe(1);
  });

  it('a material carried across 3 weeks but only completed in week 2 counts once, in week 2', () => {
    const plans = [
      plan(0, [item('A', 'PENDING', null)]),
      plan(1, [item('A', 'PENDING', null)]),
      plan(2, [item('A', 'DONE_EASY', '2026-05-20T00:00:00Z')]),
    ];
    const buckets = bucketPerWeekForTest(plans as any, 3, cycleStart);
    expect(buckets[0]!.byOutcome.DONE_EASY).toBe(0);
    expect(buckets[1]!.byOutcome.DONE_EASY).toBe(0);
    expect(buckets[2]!.byOutcome.DONE_EASY).toBe(1);
  });

  it('re-marking carried duplicates later does NOT recount: credits the first real completion week', () => {
    const plans = [
      plan(0, [item('A', 'DONE_HARD', '2026-05-06T00:00:00Z')]), // really done in week 0
      plan(1, [item('A', 'DONE_EASY', '2026-05-14T00:00:00Z')]), // carried copy re-marked
      plan(2, [item('A', 'DONE_EASY', '2026-05-21T00:00:00Z')]), // carried copy re-marked
    ];
    const buckets = bucketPerWeekForTest(plans as any, 3, cycleStart);
    expect(buckets[0]!.byOutcome.DONE_HARD).toBe(1);
    expect(buckets[1]!.byOutcome.DONE_EASY).toBe(0);
    expect(buckets[2]!.byOutcome.DONE_EASY).toBe(0);
  });

  it('distinct materials each count in the week they were completed', () => {
    const plans = [
      plan(0, [item('A', 'DONE_EASY', '2026-05-06T00:00:00Z'), item('B', 'DONE_HARD', '2026-05-20T00:00:00Z')]),
    ];
    const buckets = bucketPerWeekForTest(plans as any, 3, cycleStart);
    expect(buckets[0]!.byOutcome.DONE_EASY).toBe(1); // A done 05-06 → week 0
    expect(buckets[2]!.byOutcome.DONE_HARD).toBe(1); // B done 05-20 → week 2
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
