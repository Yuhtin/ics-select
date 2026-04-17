import { BriefPlanService } from './brief-plan.service';

describe('BriefPlanService', () => {
  it('forwards run to DraftPlanService with the same input', async () => {
    const draft = {
      run: jest.fn(async () => ({
        draft: { items: [], alternates: [], narrative: 'ok', totalMinutes: 0 },
        usage: { inputTokens: 10, outputTokens: 5, costUsd: 0 },
      })),
    };
    const svc = new BriefPlanService(draft as any);
    const input = {
      memberId: 'u1',
      weekStart: new Date('2026-04-20T00:00:00Z'),
      weekEnd: new Date('2026-04-26T23:59:59Z'),
      briefText: 'foca mais em DP',
      carryOverItemIds: ['wpi-1'],
    };
    const result = await svc.run(input);
    expect(draft.run).toHaveBeenCalledWith(input);
    expect(result.draft.narrative).toBe('ok');
  });
});
