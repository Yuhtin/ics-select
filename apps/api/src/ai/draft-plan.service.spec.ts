import {
  DraftPlanService,
  computeLadder,
  LADDER_SOLID_THRESHOLD,
} from './draft-plan.service';
import { searchLibraryTool } from './library-tool';

function makePrisma(overrides: Partial<Record<string, any>> = {}) {
  const base = {
    cycleMembership: {
      findFirst: jest.fn(async () => ({
        track: 'BIG_TECH',
        cycleId: 'c1',
        cycle: { id: 'c1', status: 'ACTIVE' },
        user: { id: 'u1', name: 'Davi' },
      })),
    },
    user: { findUnique: jest.fn(async () => ({ id: 'u1', name: 'Davi' })) },
    weeklyPlan: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      count: jest.fn(async () => 0),
    },
    weeklyPlanItem: {
      findMany: jest.fn(async () => []),
      groupBy: jest.fn(async () => []),
    },
    weeklyRetro: { findFirst: jest.fn(async () => null) },
  };
  // Deep-merge per-model so a test can override a single method without
  // losing the other mocks on the same model.
  const out: any = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    out[key] = { ...(base as any)[key], ...(value as any) };
  }
  return out;
}

function makeLibrary() {
  return {
    search: jest.fn(async () => [
      {
        id: 'li-1',
        title: 'Two Sum',
        format: 'PROBLEM',
        difficulty: 'EASY',
        estimatedMinutes: 30,
        topic: { label: 'arrays' },
        topicId: 't-arrays',
      },
      {
        id: 'li-2',
        title: 'Quick Sort',
        format: 'ARTICLE',
        difficulty: 'MEDIUM',
        estimatedMinutes: 45,
        topic: { label: 'sorting' },
        topicId: 't-sort',
      },
    ]),
    list: jest.fn(async () => []),
  };
}

function makeChat() {
  return { callJsonWithTools: jest.fn() };
}

function makeUsage() {
  return { log: jest.fn(async () => undefined) };
}

const WEEK_START = new Date('2026-04-20T00:00:00.000Z');
const WEEK_END = new Date('2026-04-26T00:00:00.000Z');

describe('DraftPlanService', () => {
  it('builds a prompt with track, last-4-weeks outcomes and reflections', async () => {
    const prisma = makePrisma({
      weeklyPlan: {
        findMany: jest.fn(async () => [
          {
            id: 'p-1',
            weekStart: new Date('2026-04-13'),
            items: [
              {
                id: 'i-1',
                outcome: 'DONE_HARD',
                reflection: 'difícil mas saiu',
                libraryItem: {
                  id: 'li-1',
                  title: 'Foo',
                  topicId: 't-arr',
                  topic: { label: 'arrays' },
                },
              },
              {
                id: 'i-2',
                outcome: 'STUCK',
                reflection: 'travei',
                libraryItem: {
                  id: 'li-2',
                  title: 'Bar',
                  topicId: 't-dp',
                  topic: { label: 'dp' },
                },
              },
            ],
          },
        ]),
      },
    });
    const chat = makeChat();
    chat.callJsonWithTools.mockResolvedValueOnce({
      data: {
        items: [{ libraryItemId: 'li-1', order: 0, rationale: 'seguir arrays' }],
        alternates: [],
        narrative: 'foco em arrays',
        totalMinutes: 30,
      },
      usage: { inputTokens: 100, outputTokens: 50, costUsd: 0.001 },
      toolCalls: [],
    });
    const library = makeLibrary();
    const usage = makeUsage();
    const svc = new DraftPlanService(chat as any, library as any, prisma as any, usage as any);
    await svc.run({ memberId: 'u1', weekStart: WEEK_START, weekEnd: WEEK_END });

    const callArg = chat.callJsonWithTools.mock.calls[0]![0] as {
      system: string;
      messages: Array<{ role: string; content: string }>;
      tools: Array<{ name: string }>;
    };
    const prompt = callArg.messages[0]!.content;
    expect(prompt).toMatch(/MEMBRO/);
    expect(prompt).toMatch(/track: Big Tech/);
    expect(prompt).toMatch(/DONE_HARD/);
    expect(prompt).toMatch(/STUCK/);
    expect(prompt).toMatch(/travei/);
    expect(prompt).toMatch(/difícil mas saiu/);
    expect(callArg.tools).toHaveLength(1);
    expect(callArg.tools[0]!.name).toBe('search_library');
    expect(callArg.tools[0]).toBe(searchLibraryTool);
  });

  it('includes RETRÔ section with content when retro is present', async () => {
    const prisma = makePrisma({
      weeklyRetro: {
        findFirst: jest.fn(async () => ({
          whatClicked: 'consegui fazer DP',
          whatStuck: 'grafos me travaram',
          nextWeekWish: 'quero ver mais árvores',
        })),
      },
    });
    const chat = makeChat();
    chat.callJsonWithTools.mockResolvedValueOnce({
      data: { items: [], alternates: [], narrative: '', totalMinutes: 0 },
      usage: { inputTokens: 10, outputTokens: 5, costUsd: 0.0001 },
      toolCalls: [],
    });
    const svc = new DraftPlanService(
      chat as any,
      makeLibrary() as any,
      prisma as any,
      makeUsage() as any,
    );
    await svc.run({ memberId: 'u1', weekStart: WEEK_START, weekEnd: WEEK_END });
    const prompt = (chat.callJsonWithTools.mock.calls[0]![0] as any).messages[0].content as string;
    expect(prompt).toMatch(/RETRÔ \(semana anterior\):/);
    expect(prompt).toMatch(/consegui fazer DP/);
    expect(prompt).toMatch(/grafos me travaram/);
    expect(prompt).toMatch(/quero ver mais árvores/);
  });

  it('emits (sem retrô submetido) when no retro exists', async () => {
    const chat = makeChat();
    chat.callJsonWithTools.mockResolvedValueOnce({
      data: { items: [], alternates: [], narrative: '', totalMinutes: 0 },
      usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
      toolCalls: [],
    });
    const svc = new DraftPlanService(
      chat as any,
      makeLibrary() as any,
      makePrisma() as any,
      makeUsage() as any,
    );
    await svc.run({ memberId: 'u1', weekStart: WEEK_START, weekEnd: WEEK_END });
    const prompt = (chat.callJsonWithTools.mock.calls[0]![0] as any).messages[0].content as string;
    expect(prompt).toMatch(/\(sem retrô submetido\)/);
  });

  it('includes CARRY-OVER section with provided ids', async () => {
    const prisma = makePrisma({
      weeklyPlanItem: {
        findMany: jest.fn(async () => [
          {
            id: 'wpi-1',
            outcome: 'STUCK',
            libraryItemId: 'li-99',
            libraryItem: {
              id: 'li-99',
              title: 'Graph Traversal',
              topicId: 't-graph',
              topic: { label: 'graphs' },
              estimatedMinutes: 60,
              format: 'PROBLEM',
              difficulty: 'HARD',
              tags: ['graphs'],
              tracks: ['BIG_TECH'],
            },
          },
        ]),
      },
    });
    const chat = makeChat();
    chat.callJsonWithTools.mockResolvedValueOnce({
      data: {
        items: [{ libraryItemId: 'li-99', order: 0, rationale: 'carry-over' }],
        alternates: [],
        narrative: 'retomar grafos',
        totalMinutes: 60,
      },
      usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
      toolCalls: [],
    });
    const svc = new DraftPlanService(
      chat as any,
      makeLibrary() as any,
      prisma as any,
      makeUsage() as any,
    );
    await svc.run({
      memberId: 'u1',
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      carryOverItemIds: ['wpi-1'],
    });
    const prompt = (chat.callJsonWithTools.mock.calls[0]![0] as any).messages[0].content as string;
    expect(prompt).toMatch(/CARRY-OVER SELECIONADO PELO ADMIN:/);
    expect(prompt).toMatch(/id=li-99/);
    expect(prompt).toMatch(/"Graph Traversal"/);
    expect(prompt).toMatch(/\(STUCK\)/);
  });

  it('includes BRIEF section when briefText is provided', async () => {
    const chat = makeChat();
    chat.callJsonWithTools.mockResolvedValueOnce({
      data: { items: [], alternates: [], narrative: '', totalMinutes: 0 },
      usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
      toolCalls: [],
    });
    const svc = new DraftPlanService(
      chat as any,
      makeLibrary() as any,
      makePrisma() as any,
      makeUsage() as any,
    );
    await svc.run({
      memberId: 'u1',
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      briefText: 'Foco em system design esta semana',
    });
    const prompt = (chat.callJsonWithTools.mock.calls[0]![0] as any).messages[0].content as string;
    expect(prompt).toMatch(/BRIEF DO ADMIN:/);
    expect(prompt).toMatch(/Foco em system design esta semana/);
  });

  it('defaults alternates to [] when missing from LLM response and logs usage', async () => {
    const chat = makeChat();
    chat.callJsonWithTools.mockResolvedValueOnce({
      data: {
        items: [{ libraryItemId: 'li-1', order: 0, rationale: 'start easy' }],
        narrative: 'foco inicial',
        totalMinutes: 30,
        // alternates intentionally omitted
      },
      usage: { inputTokens: 200, outputTokens: 80, costUsd: 0.002 },
      toolCalls: [
        { id: 'c1', name: 'search_library', args: { query: 'arrays' } },
        { id: 'c2', name: 'search_library', args: { query: 'dp' } },
      ],
    });
    const usage = makeUsage();
    const svc = new DraftPlanService(
      chat as any,
      makeLibrary() as any,
      makePrisma() as any,
      usage as any,
    );
    const result = await svc.run({
      memberId: 'u1',
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
    });
    expect(result.draft.items).toHaveLength(1);
    expect(result.draft.alternates).toEqual([]);
    expect(result.draft.narrative).toBe('foco inicial');
    expect(result.draft.totalMinutes).toBe(30);
    expect(usage.log).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'draft_plan', userId: 'u1' }),
    );
    const logArg = (usage.log as jest.Mock).mock.calls[0][0];
    expect(logArg.metadata).toEqual(
      expect.objectContaining({ carryOverCount: 0, hasBrief: false, toolCalls: 2 }),
    );
  });
});

describe('computeLadder', () => {
  const TOPICS = [
    { slug: 'foundations', label: 'Foundations', order: -1 },
    { slug: 'array', label: 'Array', order: 0 },
    { slug: 'lists', label: 'Lists', order: 1 },
    { slug: 'tree', label: 'Tree', order: 2 },
  ];

  it('focus = lowest-order topic when coverage is empty', () => {
    const ladder = computeLadder(TOPICS, new Map());
    expect(ladder.map((e) => [e.slug, e.status])).toEqual([
      ['foundations', 'focus'],
      ['array', 'locked'],
      ['lists', 'locked'],
      ['tree', 'locked'],
    ]);
    expect(ladder[0]!.done).toBe(0);
  });

  it('foundations sólido (3 done) → focus moves to array', () => {
    const coverage = new Map([
      ['Foundations', { planned: 5, done: LADDER_SOLID_THRESHOLD }],
      ['Array', { planned: 1, done: 1 }],
    ]);
    const ladder = computeLadder(TOPICS, coverage);
    expect(ladder.map((e) => [e.slug, e.status])).toEqual([
      ['foundations', 'solid'],
      ['array', 'focus'],
      ['lists', 'locked'],
      ['tree', 'locked'],
    ]);
    expect(ladder[1]!.done).toBe(1);
    expect(ladder[1]!.planned).toBe(1);
  });

  it('multiple sólidos in a row → focus skips ahead', () => {
    const coverage = new Map([
      ['Foundations', { planned: 5, done: 5 }],
      ['Array', { planned: 5, done: 5 }],
      ['Lists', { planned: 5, done: 5 }],
    ]);
    const ladder = computeLadder(TOPICS, coverage);
    expect(ladder.map((e) => [e.slug, e.status])).toEqual([
      ['foundations', 'solid'],
      ['array', 'solid'],
      ['lists', 'solid'],
      ['tree', 'focus'],
    ]);
  });

  it('all topics sólidos → last topic becomes focus', () => {
    const coverage = new Map(
      TOPICS.map((t) => [t.label, { planned: 5, done: 5 }]),
    );
    const ladder = computeLadder(TOPICS, coverage);
    expect(ladder.at(-1)!.status).toBe('focus');
    expect(ladder.slice(0, -1).every((e) => e.status === 'solid')).toBe(true);
  });

  it('topic without coverage entry counts as done=0', () => {
    const coverage = new Map([
      ['Foundations', { planned: 5, done: 5 }],
      // Array has no entry at all
    ]);
    const ladder = computeLadder(TOPICS, coverage);
    expect(ladder[1]).toMatchObject({ slug: 'array', done: 0, planned: 0, status: 'focus' });
  });
});
