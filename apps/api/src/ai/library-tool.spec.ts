import { searchLibraryTool, makeLibraryToolExecutor } from './library-tool';

describe('searchLibraryTool', () => {
  it('has the expected name, description, and parameter schema', () => {
    expect(searchLibraryTool.name).toBe('search_library');
    expect(searchLibraryTool.description).toMatch(/library/i);
    const props = (searchLibraryTool.parameters as any).properties;
    expect(props.query.type).toBe('string');
    expect(props.format.type).toBe('array');
    expect(props.format.items.enum).toContain('VIDEO');
    expect(props.tracks.items.enum).toContain('BIG_TECH');
    expect(props.topicId.type).toBe('string');
    expect(props.maxMinutes.type).toBe('number');
  });
});

describe('makeLibraryToolExecutor', () => {
  function makeLibrary() {
    return {
      search: jest.fn(async (_input: any) => [
        {
          id: 'li-1',
          title: 'DP intro',
          url: 'https://leetcode.com/x',
          description: 'Should not appear in trimmed output',
          format: 'PROBLEM',
          difficulty: 'EASY',
          estimatedMinutes: 30,
          tags: ['dp'],
          tracks: ['BIG_TECH'],
          topicId: 't-dp',
        },
      ]),
    };
  }

  it('calls library.search with passed args + limit: 20', async () => {
    const library = makeLibrary();
    const exec = makeLibraryToolExecutor(library as any);
    await exec('search_library', { query: 'dp', tracks: ['BIG_TECH'] });
    expect(library.search).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'dp', tracks: ['BIG_TECH'], limit: 20 }),
    );
  });

  it('returns a trimmed shape without description/url/tags', async () => {
    const library = makeLibrary();
    const exec = makeLibraryToolExecutor(library as any);
    const result = (await exec('search_library', { query: 'dp' })) as any[];
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'li-1',
      title: 'DP intro',
      format: 'PROBLEM',
      difficulty: 'EASY',
      estimatedMinutes: 30,
      topicId: 't-dp',
      tracks: ['BIG_TECH'],
    });
    expect(result[0]).not.toHaveProperty('description');
    expect(result[0]).not.toHaveProperty('url');
    expect(result[0]).not.toHaveProperty('tags');
  });

  it('handles missing args as empty object', async () => {
    const library = makeLibrary();
    const exec = makeLibraryToolExecutor(library as any);
    await exec('search_library', undefined);
    expect(library.search).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
  });

  it('throws for unknown tool names', async () => {
    const library = makeLibrary();
    const exec = makeLibraryToolExecutor(library as any);
    await expect(exec('something_else', {})).rejects.toThrow(/Unknown tool/);
  });
});
