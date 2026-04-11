import { AnthropicProvider } from './anthropic.provider';

const createMock = jest.fn();

class FakeClient {
  messages = { create: createMock, stream: jest.fn() };
}

describe('AnthropicProvider', () => {
  beforeEach(() => createMock.mockReset());

  it('callJson parses a JSON string response', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"foo":"bar"}' }],
      usage: { input_tokens: 10, output_tokens: 20 },
    });
    const p = new AnthropicProvider(new FakeClient() as any);
    const result = await p.callJson<{ foo: string }>({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(result.data.foo).toBe('bar');
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(20);
  });

  it('callJson throws if the response has no text block', async () => {
    createMock.mockResolvedValueOnce({ content: [], usage: { input_tokens: 1, output_tokens: 1 } });
    const p = new AnthropicProvider(new FakeClient() as any);
    await expect(
      p.callJson({ system: 's', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toThrow(/text/);
  });

  it('callText returns plain text', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Hello world' }],
      usage: { input_tokens: 5, output_tokens: 3 },
    });
    const p = new AnthropicProvider(new FakeClient() as any);
    const result = await p.callText({
      system: 's',
      messages: [{ role: 'user', content: 'x' }],
    });
    expect(result.text).toBe('Hello world');
  });
});
