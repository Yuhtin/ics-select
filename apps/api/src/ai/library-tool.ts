import type { ToolDefinition, ToolExecutor } from '../common/openai/tool-calling.js';
import type { LibraryService } from '../library/library.service.js';

export const searchLibraryTool: ToolDefinition = {
  name: 'search_library',
  description:
    "Search the ICS Select library by optional query + optional filters. Returns up to 20 candidate items the admin can add to a weekly plan. " +
    "Usage tips: " +
    "1) Omit `query` (or pass an empty string) to list everything matching the filters — this is the right call when you want to scan the whole library or just narrow by track/topic. " +
    "2) Pass a broad query like the topic slug ('dp', 'graphs') or a platform word ('leetcode', 'youtube'); search matches title, description, tags, AND URL. " +
    "3) Call multiple times with different filters/queries to diversify candidates. " +
    "4) If a call returns very few items, broaden (drop filters, omit query) before giving up — never invent IDs.",
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Free-text search term.' },
      format: {
        type: 'array',
        items: { type: 'string', enum: ['VIDEO', 'ARTICLE', 'BOOK', 'PROBLEM', 'OTHER'] },
      },
      difficulty: {
        type: 'array',
        items: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'] },
      },
      tracks: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'BIG_TECH',
            'CONSULTING_TECH',
            'COMPETITIVE_PROGRAMMING',
            'STARTUP',
            'OTHER',
          ],
        },
      },
      topicId: { type: 'string' },
      maxMinutes: { type: 'number' },
    },
  },
};

type SearchArgs = {
  query?: string;
  format?: string[];
  difficulty?: string[];
  tracks?: string[];
  topicId?: string;
  maxMinutes?: number;
};

export function makeLibraryToolExecutor(library: LibraryService): ToolExecutor {
  return async (name, args) => {
    if (name !== searchLibraryTool.name) {
      throw new Error(`Unknown tool: ${name}`);
    }
    const input = (args ?? {}) as SearchArgs;
    const results = await library.search({ ...input, limit: 20 } as any);
    return (results as any[]).map((r) => {
      // Expose every topic the item touches so the LLM can reason about
      // cross-topic items (e.g. a "5 wild data structures" video that
      // covers tree + array + databases) when diversifying a plan or
      // filling topic gaps. `topicId` (primary) is kept for
      // compatibility with prompts/specs that still reference it.
      const topics = Array.isArray(r.topics)
        ? r.topics.map((t: any) => ({
            id: t.id,
            slug: t.slug,
            isPrimary: !!t.isPrimary,
          }))
        : [];
      return {
        id: r.id,
        title: r.title,
        format: r.format,
        difficulty: r.difficulty,
        estimatedMinutes: r.estimatedMinutes,
        topicId: r.topicId ?? null,
        topics,
        tracks: r.tracks ?? [],
      };
    });
  };
}
