import { OpenAiService } from './openai.service';

const createMock = jest.fn();

class FakeOpenAI {
  embeddings = { create: createMock };
}

describe('OpenAiService.embed', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('calls text-embedding-3-small with the input and returns the vector', async () => {
    createMock.mockResolvedValueOnce({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    });
    const svc = new OpenAiService(new FakeOpenAI() as any);
    const vec = await svc.embed('hello world');
    expect(createMock).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: 'hello world',
    });
    expect(vec).toEqual([0.1, 0.2, 0.3]);
  });

  it('throws if the response is empty', async () => {
    createMock.mockResolvedValueOnce({ data: [] });
    const svc = new OpenAiService(new FakeOpenAI() as any);
    await expect(svc.embed('x')).rejects.toThrow(/no embedding/i);
  });
});
