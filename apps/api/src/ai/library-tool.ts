import type { ToolDefinition, ToolExecutor } from '../common/openai/tool-calling.js';
import type { LibraryService } from '../library/library.service.js';

export const searchLibraryTool: ToolDefinition = {
  name: 'search_library',
  description:
    "Search the ICS Select library by query and optional filters. Returns up to 20 candidate items the admin can add to a weekly plan. Use this to find items matching the member's needs (e.g. a DP topic, a specific format, a track). Call multiple times with different queries to diversify candidates.",
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
    return (results as any[]).map((r) => ({
      id: r.id,
      title: r.title,
      format: r.format,
      difficulty: r.difficulty,
      estimatedMinutes: r.estimatedMinutes,
      topicId: r.topicId ?? null,
      tracks: r.tracks ?? [],
    }));
  };
}
