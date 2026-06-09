import { ReportsService } from './reports.service';

function fakePrisma() {
  return {
    cycle: {
      findUnique: jest.fn(async () => ({
        id: 'c-1',
        name: '2026.1',
        startsAt: new Date('2026-04-01'),
        endsAt: new Date('2026-07-01'),
        status: 'ACTIVE',
        memberships: [
          { id: 'm-1', user: { id: 'u-1', name: 'Pedro', email: 'p@x.com' } },
        ],
        classes: [
          {
            id: 'cls-1',
            title: 'Aula 1',
            attendance: [{ userId: 'u-1', status: 'PRESENT' }],
          },
        ],
      })),
    },
    weeklyPlan: {
      findMany: jest.fn(async () => [
        {
          id: 'p-1',
          userId: 'u-1',
          status: 'PUBLISHED',
          items: [
            { id: 'i-1', libraryItemId: 'li-x', completedAt: new Date('2026-04-10'), outcome: 'DONE_EASY', libraryItem: { title: 'X' } },
            { id: 'i-2', libraryItemId: 'li-y', completedAt: null, outcome: 'PENDING', libraryItem: { title: 'Y' } },
          ],
        },
      ]),
    },
  };
}

describe('ReportsService.buildCycleReport', () => {
  it('produces a markdown report with member stats', async () => {
    const prisma = fakePrisma();
    const svc = new ReportsService(prisma as any);
    const md = await svc.buildCycleReport('c-1');
    expect(md).toContain('# Relatório do Ciclo 2026.1');
    expect(md).toContain('Pedro');
    expect(md).toContain('1/2');
  });

  it('counts a material carried + completed across weeks once per member', async () => {
    const prisma = fakePrisma();
    // Same libraryItem 'li-x' completed in three different weekly plans.
    prisma.weeklyPlan.findMany = jest.fn(async () => [
      { id: 'p-1', userId: 'u-1', status: 'PUBLISHED', items: [
        { id: 'a', libraryItemId: 'li-x', completedAt: new Date('2026-04-10'), outcome: 'DONE_EASY', libraryItem: { title: 'X' } },
      ] },
      { id: 'p-2', userId: 'u-1', status: 'PUBLISHED', items: [
        { id: 'b', libraryItemId: 'li-x', completedAt: new Date('2026-04-17'), outcome: 'DONE_EASY', libraryItem: { title: 'X' } },
      ] },
      { id: 'p-3', userId: 'u-1', status: 'PUBLISHED', items: [
        { id: 'c', libraryItemId: 'li-x', completedAt: new Date('2026-04-24'), outcome: 'DONE_EASY', libraryItem: { title: 'X' } },
        { id: 'd', libraryItemId: 'li-y', completedAt: null, outcome: 'PENDING', libraryItem: { title: 'Y' } },
      ] },
    ]);
    const svc = new ReportsService(prisma as any);
    const md = await svc.buildCycleReport('c-1');
    // 1 distinct material done (li-x), 2 distinct planned (li-x, li-y) → 1/2, not 3/4.
    expect(md).toContain('**Pedro** (p@x.com): 1/2 itens');
    expect(md).toContain('- Itens totais: 2');
    expect(md).toContain('- Itens concluídos: 1 (50%)');
  });
});
