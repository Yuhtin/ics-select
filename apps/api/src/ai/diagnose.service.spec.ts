import { DiagnoseService } from './diagnose.service';

const chat = { callText: jest.fn() };
const plans = {
  listForMember: jest.fn(async () => [
    {
      id: 'p-1',
      weekStart: new Date('2026-04-06'),
      items: [
        { id: 'i-1', outcome: 'DONE_HARD', reflection: 'recursion hard', libraryItem: { title: 'Recursion', tags: ['recursion'] } },
      ],
    },
  ]),
};
const usage = { log: jest.fn(async () => undefined) };
const prisma = {
  mockInterview: { findMany: jest.fn(async (): Promise<any[]> => []) },
};

describe('DiagnoseService', () => {
  beforeEach(() => {
    chat.callText.mockReset();
    usage.log.mockClear();
    prisma.mockInterview.findMany.mockClear();
  });

  it('produces a markdown diagnostic and caches it', async () => {
    chat.callText.mockResolvedValue({
      text: '## Pontos fortes\n- Recursão\n## Sugestão\nFocar em DP',
      usage: { inputTokens: 400, outputTokens: 200, costUsd: 0.004 },
    });
    const svc = new DiagnoseService(
      chat as any,
      plans as any,
      prisma as any,
      usage as any,
    );
    const first = await svc.run('u-1');
    const second = await svc.run('u-1');
    expect(first.markdown).toContain('Pontos fortes');
    expect(chat.callText).toHaveBeenCalledTimes(1); // second call hit cache
    expect(usage.log).toHaveBeenCalledTimes(1);
    expect(second.cached).toBe(true);
  });

  it('injects mock history into the prompt when mocks exist', async () => {
    prisma.mockInterview.findMany.mockResolvedValueOnce([
      {
        id: 'm-1',
        type: 'CODING',
        score: 3,
        feedback: 'Struggled with base cases',
        conductedBy: 'Davi',
        conductedAt: new Date('2026-05-15'),
        topics: ['tree', 'recursion'],
      },
    ]);
    chat.callText.mockResolvedValue({
      text: '## Pontos fortes',
      usage: { inputTokens: 100, outputTokens: 50, costUsd: 0.001 },
    });
    const svc = new DiagnoseService(
      chat as any,
      plans as any,
      prisma as any,
      usage as any,
    );
    await svc.run('u-mock');
    const call = chat.callText.mock.calls[0]![0];
    expect(call.messages[0].content).toContain('MOCK INTERVIEWS');
    expect(call.messages[0].content).toContain('[CODING] score 3/5');
    expect(call.messages[0].content).toContain('tree, recursion');
  });
});
