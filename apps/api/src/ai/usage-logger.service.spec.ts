import { UsageLoggerService } from './usage-logger.service';

function fakePrisma() {
  const rows: any[] = [];
  return {
    rows,
    aiGeneration: {
      create: jest.fn(async ({ data }: any) => {
        rows.push(data);
        return { id: `g-${rows.length}`, ...data };
      }),
    },
  };
}

describe('UsageLoggerService', () => {
  it('logs a generation row', async () => {
    const prisma = fakePrisma();
    const svc = new UsageLoggerService(prisma as any);
    await svc.log({
      userId: 'u-1',
      purpose: 'draft_plan',
      model: 'claude-sonnet-4-5',
      usage: { inputTokens: 100, outputTokens: 50, costUsd: 0.001 },
      metadata: { basePlanId: 'p-1' },
    });
    expect(prisma.rows).toHaveLength(1);
    expect(prisma.rows[0].purpose).toBe('draft_plan');
    expect(prisma.rows[0].promptTokens).toBe(100);
  });
});
