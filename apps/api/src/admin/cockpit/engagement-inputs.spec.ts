import { computeEngagementInputsForCohort } from './engagement-inputs';

const CYCLE_START = new Date('2026-04-06T00:00:00Z');
const NOW = new Date('2026-04-17T12:00:00Z');

function makePrisma(rows: Array<{
  userId: string;
  daysActive: number;
  itemsDone: number;
  itemsPlanned: number;
  retrosSubmitted: number;
  daysSinceLastSession: number | null;
  classesAttended?: number;
  classesHeld?: number;
}>) {
  return {
    $queryRawUnsafe: jest.fn(async () =>
      rows.map((r) => ({
        userId: r.userId,
        daysActive: r.daysActive,
        itemsDone: r.itemsDone,
        itemsPlanned: r.itemsPlanned,
        retrosSubmitted: r.retrosSubmitted,
        daysSinceLastSession: r.daysSinceLastSession,
        classesAttended: r.classesAttended ?? 0,
        classesHeld: r.classesHeld ?? 0,
      })),
    ),
  };
}

describe('computeEngagementInputsForCohort', () => {
  it('returns empty map for empty cohort', async () => {
    const prisma = makePrisma([]);
    const result = await computeEngagementInputsForCohort(
      prisma as any,
      [],
      'cycle-1',
      CYCLE_START,
      NOW,
    );
    expect(result.size).toBe(0);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('returns one input per user with computed daysElapsed/weeksElapsed', async () => {
    const prisma = makePrisma([
      {
        userId: 'u-1',
        daysActive: 8,
        itemsDone: 10,
        itemsPlanned: 12,
        retrosSubmitted: 1,
        daysSinceLastSession: 2,
      },
    ]);
    const result = await computeEngagementInputsForCohort(
      prisma as any,
      ['u-1'],
      'cycle-1',
      CYCLE_START,
      NOW,
    );
    expect(result.size).toBe(1);
    const input = result.get('u-1')!;
    expect(input.itemsDone).toBe(10);
    expect(input.itemsPlanned).toBe(12);
    expect(input.daysActive).toBe(8);
    expect(input.retrosSubmitted).toBe(1);
    expect(input.daysSinceLastSession).toBe(2);
    expect(input.daysElapsed).toBe(11); // 2026-04-06 → 2026-04-17 = 11 days
    expect(input.weeksElapsed).toBe(2); // ceil(11/7)
    expect(input.cohortSize).toBe(0); // single member, no peers
  });

  it('passes cohortSize equal to other-than-self count for ranking semantics', async () => {
    const prisma = makePrisma([
      { userId: 'u-1', daysActive: 1, itemsDone: 1, itemsPlanned: 1, retrosSubmitted: 0, daysSinceLastSession: 1 },
      { userId: 'u-2', daysActive: 2, itemsDone: 2, itemsPlanned: 2, retrosSubmitted: 0, daysSinceLastSession: 1 },
      { userId: 'u-3', daysActive: 3, itemsDone: 3, itemsPlanned: 3, retrosSubmitted: 0, daysSinceLastSession: 1 },
    ]);
    const result = await computeEngagementInputsForCohort(
      prisma as any,
      ['u-1', 'u-2', 'u-3'],
      'cycle-1',
      CYCLE_START,
      NOW,
    );
    expect(result.get('u-1')!.cohortSize).toBe(2);
    expect(result.get('u-2')!.cohortSize).toBe(2);
    expect(result.get('u-3')!.cohortSize).toBe(2);
  });

  it('orders cohortRankFromBottom by itemsDone ascending', async () => {
    const prisma = makePrisma([
      { userId: 'u-low', daysActive: 1, itemsDone: 1, itemsPlanned: 5, retrosSubmitted: 0, daysSinceLastSession: 1 },
      { userId: 'u-mid', daysActive: 1, itemsDone: 5, itemsPlanned: 5, retrosSubmitted: 0, daysSinceLastSession: 1 },
      { userId: 'u-top', daysActive: 1, itemsDone: 10, itemsPlanned: 10, retrosSubmitted: 0, daysSinceLastSession: 1 },
    ]);
    const result = await computeEngagementInputsForCohort(
      prisma as any,
      ['u-low', 'u-mid', 'u-top'],
      'cycle-1',
      CYCLE_START,
      NOW,
    );
    expect(result.get('u-low')!.cohortRankFromBottom).toBe(0);
    expect(result.get('u-mid')!.cohortRankFromBottom).toBe(1);
    expect(result.get('u-top')!.cohortRankFromBottom).toBe(2);
  });

  it('computes cohortMedianItemsPlanned across cohort', async () => {
    const prisma = makePrisma([
      { userId: 'u-a', daysActive: 1, itemsDone: 1, itemsPlanned: 4, retrosSubmitted: 0, daysSinceLastSession: 1 },
      { userId: 'u-b', daysActive: 1, itemsDone: 1, itemsPlanned: 8, retrosSubmitted: 0, daysSinceLastSession: 1 },
      { userId: 'u-c', daysActive: 1, itemsDone: 1, itemsPlanned: 12, retrosSubmitted: 0, daysSinceLastSession: 1 },
    ]);
    const result = await computeEngagementInputsForCohort(
      prisma as any,
      ['u-a', 'u-b', 'u-c'],
      'cycle-1',
      CYCLE_START,
      NOW,
    );
    expect(result.get('u-a')!.cohortMedianItemsPlanned).toBe(8);
  });

  it('propagates classesAttended and classesHeld to EngagementInput', async () => {
    const prisma = makePrisma([
      {
        userId: 'u-1',
        daysActive: 5,
        itemsDone: 3,
        itemsPlanned: 6,
        retrosSubmitted: 1,
        daysSinceLastSession: 2,
        classesAttended: 3,
        classesHeld: 4,
      },
    ]);
    const result = await computeEngagementInputsForCohort(
      prisma as any,
      ['u-1'],
      'cycle-1',
      CYCLE_START,
      NOW,
    );
    const input = result.get('u-1')!;
    expect(input.classesAttended).toBe(3);
    expect(input.classesHeld).toBe(4);
  });

  it('dedups carried completions: itemsDone/itemsPlanned count DISTINCT libraryItems', async () => {
    const prisma = makePrisma([
      { userId: 'u-1', daysActive: 1, itemsDone: 1, itemsPlanned: 1, retrosSubmitted: 0, daysSinceLastSession: 1 },
    ]);
    await computeEngagementInputsForCohort(prisma as any, ['u-1'], 'cycle-1', CYCLE_START, NOW);
    const sql = (prisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0] as string;
    // wp_done: distinct materials among non-PENDING rows (the carried-over fix).
    expect(sql).toMatch(
      /COUNT\(DISTINCT wpi\."libraryItemId"\)::int AS cnt[\s\S]*?wpi\."outcome" <> 'PENDING'[\s\S]*?\) wp_done/,
    );
    // wp_plan: distinct planned materials so the denominator matches.
    expect(sql).toMatch(/COUNT\(DISTINCT wpi\."libraryItemId"\)::int AS cnt[\s\S]*?\) wp_plan/);
    // The old un-deduped COUNT(*) for the done join must be gone.
    expect(sql).not.toMatch(/COUNT\(\*\)::int AS cnt[\s\S]*?\) wp_done/);
  });

});

