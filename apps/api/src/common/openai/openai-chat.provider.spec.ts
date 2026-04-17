import { OpenAiChatProvider } from './openai-chat.provider';

const createMock = jest.fn();

class FakeClient {
  chat = { completions: { create: createMock } };
}

describe('OpenAiChatProvider', () => {
  beforeEach(() => createMock.mockReset());

  it('callJson parses a JSON string response from chat completions', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: '{"foo":"bar"}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    });
    const p = new OpenAiChatProvider(new FakeClient() as any);
    const result = await p.callJson<{ foo: string }>({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(result.data.foo).toBe('bar');
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(20);
  });

  it('callJson throws if the response has no content', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    const p = new OpenAiChatProvider(new FakeClient() as any);
    await expect(
      p.callJson({ system: 's', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toThrow(/content/);
  });

  it('callText returns plain text', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: 'Hello world' } }],
      usage: { prompt_tokens: 5, completion_tokens: 3 },
    });
    const p = new OpenAiChatProvider(new FakeClient() as any);
    const result = await p.callText({
      system: 's',
      messages: [{ role: 'user', content: 'x' }],
    });
    expect(result.text).toBe('Hello world');
  });

  it('stream yields plain text tokens from chunks', async () => {
    async function* fakeStream() {
      yield { choices: [{ delta: { content: 'Hello' } }] };
      yield { choices: [{ delta: { content: ' ' } }] };
      yield { choices: [{ delta: { content: 'world' } }] };
      yield { choices: [{ delta: {} }] };
    }
    createMock.mockResolvedValueOnce(fakeStream());
    const p = new OpenAiChatProvider(new FakeClient() as any);
    const tokens: string[] = [];
    for await (const t of p.stream({
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      tokens.push(t);
    }
    expect(tokens).toEqual(['Hello', ' ', 'world']);
  });
});

describe('OpenAiChatProvider.callJsonWithTools', () => {
  beforeEach(() => createMock.mockReset());

  it('returns data when model answers on first turn', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
      usage: { prompt_tokens: 50, completion_tokens: 10 },
    });
    const executor = jest.fn();
    const svc = new OpenAiChatProvider(new FakeClient() as any);
    const res = await svc.callJsonWithTools<{ ok: boolean }>({
      system: 'sys',
      messages: [{ role: 'user', content: 'go' }],
      tools: [
        {
          name: 'search_library',
          description: 'desc',
          parameters: { type: 'object' },
        },
      ],
      executeTool: executor,
    });
    expect(res.data).toEqual({ ok: true });
    expect(res.toolCalls).toHaveLength(0);
    expect(res.usage.inputTokens).toBe(50);
    expect(res.usage.outputTokens).toBe(10);
    expect(executor).not.toHaveBeenCalled();
  });

  it('iterates through a tool call and returns final data', async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: 'c1',
                  type: 'function',
                  function: {
                    name: 'search_library',
                    arguments: '{"query":"dp"}',
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({ items: [{ id: 'li-1' }] }),
            },
          },
        ],
        usage: { prompt_tokens: 80, completion_tokens: 40 },
      });
    const executor = jest.fn(async () => ({ items: [{ id: 'li-1' }] }));
    const svc = new OpenAiChatProvider(new FakeClient() as any);
    const res = await svc.callJsonWithTools<{ items: Array<{ id: string }> }>({
      system: 'sys',
      messages: [{ role: 'user', content: 'pick' }],
      tools: [
        {
          name: 'search_library',
          description: 'd',
          parameters: { type: 'object' },
        },
      ],
      executeTool: executor,
    });
    expect(executor).toHaveBeenCalledWith('search_library', { query: 'dp' });
    expect(res.data.items[0]!.id).toBe('li-1');
    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls[0]!.name).toBe('search_library');
    expect(res.toolCalls[0]!.args).toEqual({ query: 'dp' });
    expect(res.toolCalls[0]!.id).toBe('c1');
    expect(res.usage.inputTokens).toBe(180);
    expect(res.usage.outputTokens).toBe(60);
  });

  it('executes multiple tool calls in a single turn', async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: 'c1',
                  type: 'function',
                  function: {
                    name: 'search_library',
                    arguments: '{"query":"dp"}',
                  },
                },
                {
                  id: 'c2',
                  type: 'function',
                  function: {
                    name: 'search_library',
                    arguments: '{"query":"graphs"}',
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 30 },
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({ picked: 2 }),
            },
          },
        ],
        usage: { prompt_tokens: 120, completion_tokens: 20 },
      });
    const executor = jest.fn(async (_name: string, args: unknown) => ({
      received: args,
    }));
    const svc = new OpenAiChatProvider(new FakeClient() as any);
    const res = await svc.callJsonWithTools<{ picked: number }>({
      system: 'sys',
      messages: [{ role: 'user', content: 'multi' }],
      tools: [
        {
          name: 'search_library',
          description: 'd',
          parameters: { type: 'object' },
        },
      ],
      executeTool: executor,
    });
    expect(executor).toHaveBeenCalledTimes(2);
    expect(executor).toHaveBeenNthCalledWith(1, 'search_library', {
      query: 'dp',
    });
    expect(executor).toHaveBeenNthCalledWith(2, 'search_library', {
      query: 'graphs',
    });
    expect(res.toolCalls).toHaveLength(2);
    expect(res.toolCalls[0]!.id).toBe('c1');
    expect(res.toolCalls[1]!.id).toBe('c2');
    expect(res.data.picked).toBe(2);
    expect(res.usage.inputTokens).toBe(220);
    expect(res.usage.outputTokens).toBe(50);
  });

  it('throws when loop exceeds maxIterations', async () => {
    // Always return tool_calls — the model never commits to a final answer.
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: 'c-loop',
                type: 'function',
                function: {
                  name: 'search_library',
                  arguments: '{"query":"x"}',
                },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
    const executor = jest.fn(async () => ({ items: [] }));
    const svc = new OpenAiChatProvider(new FakeClient() as any);
    await expect(
      svc.callJsonWithTools<{ ok: boolean }>({
        system: 'sys',
        messages: [{ role: 'user', content: 'loop' }],
        tools: [
          {
            name: 'search_library',
            description: 'd',
            parameters: { type: 'object' },
          },
        ],
        executeTool: executor,
        maxIterations: 2,
      }),
    ).rejects.toThrow(/content/);
  });

  it('tolerates malformed tool call arguments', async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: 'c1',
                  type: 'function',
                  function: {
                    name: 'search_library',
                    arguments: 'not json',
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: { content: JSON.stringify({ ok: true }) },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
    const executor = jest.fn(async () => ({ items: [] }));
    const svc = new OpenAiChatProvider(new FakeClient() as any);
    const res = await svc.callJsonWithTools<{ ok: boolean }>({
      system: 'sys',
      messages: [{ role: 'user', content: 'malformed' }],
      tools: [
        {
          name: 'search_library',
          description: 'd',
          parameters: { type: 'object' },
        },
      ],
      executeTool: executor,
    });
    expect(executor).toHaveBeenCalledWith('search_library', {});
    expect(res.toolCalls[0]!.args).toEqual({});
    expect(res.data.ok).toBe(true);
  });
});
