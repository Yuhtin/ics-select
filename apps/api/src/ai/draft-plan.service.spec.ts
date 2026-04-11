import { DraftPlanService } from './draft-plan.service';

const chat = {
  callJson: jest.fn(),
};
const library = {
  list: jest.fn(async () => [
    { id: 'li-1', title: 'DP Intro', estimatedMinutes: 30, format: 'VIDEO', difficulty: 'EASY', tags: ['dp'], description: null },
  ]),
  search: jest.fn(async () => [
    { id: 'li-1', title: 'DP Intro', estimatedMinutes: 30, format: 'VIDEO', difficulty: 'EASY', tags: ['dp'], description: null, score: 0.8 },
  ]),
};
const plans = {
  listForMember: jest.fn(async () => [
    {
      id: 'p-1',
      weekStart: new Date('2026-04-06'),
      weekEnd: new Date('2026-04-12'),
      status: 'COMPLETED',
      items: [
        {
          id: 'i-1',
          status: 'DONE',
          difficultyRating: 'HARD',
          reflection: 'Hard on recursion',
          libraryItem: { id: 'li-1', title: 'Recursion', tags: ['recursion'] },
        },
      ],
    },
  ]),
};
const usage = { log: jest.fn(async () => undefined) };

describe('DraftPlanService', () => {
  beforeEach(() => {
    chat.callJson.mockReset();
    usage.log.mockClear();
  });

  it('returns a draft plan with items and narrative', async () => {
    chat.callJson.mockResolvedValueOnce({
      data: {
        items: [
          { libraryItemId: 'li-1', order: 0, rationale: 'Builds on previous hard item' },
        ],
        narrative: 'Foco da semana: recursão',
        totalMinutes: 30,
      },
      usage: { inputTokens: 500, outputTokens: 100, costUsd: 0.003 },
    });
    const svc = new DraftPlanService(chat as any, library as any, plans as any, usage as any);
    const result = await svc.run({ memberId: 'u-1' });
    expect(result.draft.items).toHaveLength(1);
    expect(result.draft.narrative).toContain('recursão');
    expect(usage.log).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'draft_plan', userId: 'u-1' }),
    );
  });
});
