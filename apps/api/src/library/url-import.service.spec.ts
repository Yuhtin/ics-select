import { UrlImportService } from './url-import.service';

type MockFetch = (url: string) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

function withFetch(html: string): UrlImportService {
  const mockFetch: MockFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => html,
  });
  return new UrlImportService(mockFetch as unknown as typeof fetch);
}

describe('UrlImportService.extract', () => {
  it('extracts Open Graph metadata from a generic article', async () => {
    const svc = withFetch(`
      <html>
        <head>
          <meta property="og:title" content="Demystifying Hash Maps" />
          <meta property="og:description" content="A walkthrough of hash table internals." />
          <meta property="og:site_name" content="Example Tech Blog" />
        </head>
      </html>
    `);
    const result = await svc.extract('https://example.com/hashmaps');
    expect(result.title).toBe('Demystifying Hash Maps');
    expect(result.description).toBe('A walkthrough of hash table internals.');
    expect(result.source).toBe('Example Tech Blog');
    expect(result.format).toBe('ARTICLE');
  });

  it('falls back to <title> when og:title is missing', async () => {
    const svc = withFetch(`<html><head><title>Fallback Title</title></head></html>`);
    const result = await svc.extract('https://example.com/x');
    expect(result.title).toBe('Fallback Title');
    expect(result.format).toBe('ARTICLE');
  });

  it('detects YouTube URLs as VIDEO', async () => {
    const svc = withFetch(`<html><head><meta property="og:title" content="DP Tutorial" /></head></html>`);
    const result = await svc.extract('https://www.youtube.com/watch?v=abc');
    expect(result.format).toBe('VIDEO');
    expect(result.source).toBe('YouTube');
  });

  it('detects LeetCode URLs as PROBLEM', async () => {
    const svc = withFetch(`<html><head><title>Two Sum - LeetCode</title></head></html>`);
    const result = await svc.extract('https://leetcode.com/problems/two-sum/');
    expect(result.format).toBe('PROBLEM');
    expect(result.source).toBe('LeetCode');
  });

  it('returns default metadata when fetch fails', async () => {
    const mockFetch: MockFetch = async () => ({
      ok: false,
      status: 500,
      text: async () => '',
    });
    const svc = new UrlImportService(mockFetch as unknown as typeof fetch);
    const result = await svc.extract('https://example.com/broken');
    expect(result.title).toBe('example.com/broken');
    expect(result.format).toBe('OTHER');
  });
});
