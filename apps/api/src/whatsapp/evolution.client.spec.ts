import { EvolutionApiClient } from './evolution.client';

function fakeConfig(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      if (!values[key]) throw new Error(`missing ${key}`);
      return values[key]!;
    },
  };
}

describe('EvolutionApiClient', () => {
  it('isConfigured returns false when vars missing', () => {
    const client = new EvolutionApiClient(fakeConfig({}) as any);
    expect(client.isConfigured).toBe(false);
  });

  it('isConfigured returns true when all three vars present', () => {
    const client = new EvolutionApiClient(
      fakeConfig({
        EVOLUTION_API_BASE_URL: 'http://e',
        EVOLUTION_API_KEY: 'k',
        EVOLUTION_INSTANCE: 'i',
      }) as any,
    );
    expect(client.isConfigured).toBe(true);
  });

  it('sendText returns ok when fetcher returns 200', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    const client = new EvolutionApiClient(
      fakeConfig({
        EVOLUTION_API_BASE_URL: 'http://e',
        EVOLUTION_API_KEY: 'k',
        EVOLUTION_INSTANCE: 'i',
      }) as any,
      fetcher as any,
    );
    const result = await client.sendText({ to: '5511999', text: 'hi' });
    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      'http://e/message/sendText/i',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sendText returns error when not configured', async () => {
    const client = new EvolutionApiClient(fakeConfig({}) as any);
    const result = await client.sendText({ to: 'x', text: 'y' });
    expect(result.ok).toBe(false);
  });
});
