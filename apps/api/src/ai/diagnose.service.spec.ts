import { DiagnoseService } from './diagnose.service';

const chat = { callText: jest.fn() };
const plans = {
  listForMember: jest.fn(async () => [
    {
      id: 'p-1',
      weekStart: new Date('2026-04-06'),
      items: [
        { id: 'i-1', status: 'DONE', difficultyRating: 'HARD', reflection: 'recursion hard', libraryItem: { title: 'Recursion', tags: ['recursion'] } },
      ],
    },
  ]),
};
const usage = { log: jest.fn(async () => undefined) };

describe('DiagnoseService', () => {
  beforeEach(() => {
    chat.callText.mockReset();
    usage.log.mockClear();
  });

  it('produces a markdown diagnostic and caches it', async () => {
    chat.callText.mockResolvedValue({
      text: '## Pontos fortes\n- Recursão\n## Sugestão\nFocar em DP',
      usage: { inputTokens: 400, outputTokens: 200, costUsd: 0.004 },
    });
    const svc = new DiagnoseService(chat as any, plans as any, usage as any);
    const first = await svc.run('u-1');
    const second = await svc.run('u-1');
    expect(first.markdown).toContain('Pontos fortes');
    expect(chat.callText).toHaveBeenCalledTimes(1); // second call hit cache
    expect(usage.log).toHaveBeenCalledTimes(1);
    expect(second.cached).toBe(true);
  });
});
