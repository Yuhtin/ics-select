import { OpenAiChatProvider } from './openai-chat.provider';

const createMock = jest.fn();

const responsesMock = jest.fn();

class FakeClient {
  chat = { completions: { create: createMock } };
  responses = { create: responsesMock };
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
  // Tool calling runs on the Responses API — OpenAI rejects function tools
  // together with reasoning_effort on chat completions.
  beforeEach(() => responsesMock.mockReset());

  const TOOL = {
    name: 'search_library',
    description: 'desc',
    parameters: { type: 'object' },
  };

  function fnCall(callId: string, args: string) {
    return {
      type: 'function_call',
      call_id: callId,
      name: 'search_library',
      arguments: args,
    };
  }

  function reply(opts: {
    id?: string;
    output?: unknown[];
    text?: string;
    inputTokens?: number;
    outputTokens?: number;
    status?: string;
    incompleteReason?: string;
  }) {
    return {
      id: opts.id ?? 'resp-1',
      status: opts.status ?? 'completed',
      incomplete_details: opts.incompleteReason
        ? { reason: opts.incompleteReason }
        : null,
      output: opts.output ?? [],
      output_text: opts.text ?? '',
      usage: {
        input_tokens: opts.inputTokens ?? 0,
        output_tokens: opts.outputTokens ?? 0,
      },
    };
  }

  it('returns data when model answers on first turn', async () => {
    responsesMock.mockResolvedValueOnce(
      reply({ text: JSON.stringify({ ok: true }), inputTokens: 50, outputTokens: 10 }),
    );
    const executor = jest.fn();
    const svc = new OpenAiChatProvider(new FakeClient() as any);
    const res = await svc.callJsonWithTools<{ ok: boolean }>({
      system: 'sys',
      messages: [{ role: 'user', content: 'go' }],
      tools: [TOOL],
      executeTool: executor,
    });
    expect(res.data).toEqual({ ok: true });
    expect(res.toolCalls).toHaveLength(0);
    expect(res.usage.inputTokens).toBe(50);
    expect(res.usage.outputTokens).toBe(10);
    expect(executor).not.toHaveBeenCalled();
  });

  it('forwards model, reasoning effort and non-strict tools', async () => {
    responsesMock.mockResolvedValueOnce(reply({ text: '{"ok":true}' }));
    const svc = new OpenAiChatProvider(new FakeClient() as any);
    await svc.callJsonWithTools({
      system: 'sys',
      messages: [{ role: 'user', content: 'go' }],
      tools: [TOOL],
      executeTool: jest.fn(),
      model: 'gpt-5.6-luna',
      reasoningEffort: 'xhigh',
      maxTokens: 16000,
    });
    const arg = responsesMock.mock.calls[0]![0];
    expect(arg.model).toBe('gpt-5.6-luna');
    expect(arg.reasoning).toEqual({ effort: 'xhigh' });
    expect(arg.max_output_tokens).toBe(16000);
    expect(arg.instructions).toBe('sys');
    // strict defaults to true on the Responses API and our schemas aren't
    // strict-compliant, so it has to be sent explicitly.
    expect(arg.tools[0].strict).toBe(false);
    expect(arg.tools[0].name).toBe('search_library');
  });

  it('iterates through a tool call and returns final data', async () => {
    responsesMock
      .mockResolvedValueOnce(
        reply({
          id: 'resp-a',
          output: [fnCall('c1', '{"query":"dp"}')],
          inputTokens: 100,
          outputTokens: 20,
        }),
      )
      .mockResolvedValueOnce(
        reply({
          id: 'resp-b',
          text: JSON.stringify({ items: [{ id: 'li-1' }] }),
          inputTokens: 80,
          outputTokens: 40,
        }),
      );
    const executor = jest.fn(async () => ({ items: [{ id: 'li-1' }] }));
    const svc = new OpenAiChatProvider(new FakeClient() as any);
    const res = await svc.callJsonWithTools<{ items: Array<{ id: string }> }>({
      system: 'sys',
      messages: [{ role: 'user', content: 'pick' }],
      tools: [TOOL],
      executeTool: executor,
    });
    expect(executor).toHaveBeenCalledWith('search_library', { query: 'dp' });
    expect(res.data.items[0]!.id).toBe('li-1');
    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls[0]!.id).toBe('c1');
    expect(res.usage.inputTokens).toBe(180);
    expect(res.usage.outputTokens).toBe(60);

    // Second turn chains on the stored response and only carries the output.
    const second = responsesMock.mock.calls[1]![0];
    expect(second.previous_response_id).toBe('resp-a');
    expect(second.input).toEqual([
      {
        type: 'function_call_output',
        call_id: 'c1',
        output: JSON.stringify({ items: [{ id: 'li-1' }] }),
      },
    ]);
  });

  it('executes multiple tool calls in a single turn', async () => {
    responsesMock
      .mockResolvedValueOnce(
        reply({
          output: [fnCall('c1', '{"query":"dp"}'), fnCall('c2', '{"query":"graphs"}')],
          inputTokens: 100,
          outputTokens: 30,
        }),
      )
      .mockResolvedValueOnce(
        reply({ text: JSON.stringify({ picked: 2 }), inputTokens: 120, outputTokens: 20 }),
      );
    const executor = jest.fn(async (_name: string, args: unknown) => ({
      received: args,
    }));
    const svc = new OpenAiChatProvider(new FakeClient() as any);
    const res = await svc.callJsonWithTools<{ picked: number }>({
      system: 'sys',
      messages: [{ role: 'user', content: 'multi' }],
      tools: [TOOL],
      executeTool: executor,
    });
    expect(executor).toHaveBeenCalledTimes(2);
    expect(executor).toHaveBeenNthCalledWith(1, 'search_library', { query: 'dp' });
    expect(executor).toHaveBeenNthCalledWith(2, 'search_library', { query: 'graphs' });
    expect(res.toolCalls.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(res.data.picked).toBe(2);
    expect(res.usage.inputTokens).toBe(220);
    expect(res.usage.outputTokens).toBe(50);
  });

  it('throws when loop exceeds maxIterations', async () => {
    // Always returns a tool call — the model never commits to a final answer.
    responsesMock.mockResolvedValue(reply({ output: [fnCall('c-loop', '{"query":"x"}')] }));
    const executor = jest.fn(async () => ({ items: [] }));
    const svc = new OpenAiChatProvider(new FakeClient() as any);
    await expect(
      svc.callJsonWithTools<{ ok: boolean }>({
        system: 'sys',
        messages: [{ role: 'user', content: 'loop' }],
        tools: [TOOL],
        executeTool: executor,
        maxIterations: 2,
      }),
    ).rejects.toThrow(/content/);
  });

  it('throws a legible error when the response is truncated', async () => {
    responsesMock.mockResolvedValueOnce(
      reply({ status: 'incomplete', incompleteReason: 'max_output_tokens' }),
    );
    const svc = new OpenAiChatProvider(new FakeClient() as any);
    await expect(
      svc.callJsonWithTools({
        system: 'sys',
        messages: [{ role: 'user', content: 'x' }],
        tools: [TOOL],
        executeTool: jest.fn(),
        maxTokens: 500,
      }),
    ).rejects.toThrow(/max_output_tokens/);
  });

  it('tolerates malformed tool call arguments', async () => {
    responsesMock
      .mockResolvedValueOnce(reply({ output: [fnCall('c1', 'not json')] }))
      .mockResolvedValueOnce(reply({ text: JSON.stringify({ ok: true }) }));
    const executor = jest.fn(async () => ({ items: [] }));
    const svc = new OpenAiChatProvider(new FakeClient() as any);
    const res = await svc.callJsonWithTools<{ ok: boolean }>({
      system: 'sys',
      messages: [{ role: 'user', content: 'malformed' }],
      tools: [TOOL],
      executeTool: executor,
    });
    expect(executor).toHaveBeenCalledWith('search_library', {});
    expect(res.toolCalls[0]!.args).toEqual({});
    expect(res.data.ok).toBe(true);
  });
});
