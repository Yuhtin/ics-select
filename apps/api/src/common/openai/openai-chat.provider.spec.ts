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
