import Fuse, { type IFuseOptions } from 'fuse.js';
import type { AdminLibraryItem } from '../queries/admin-library';

const FUSE_OPTIONS: IFuseOptions<AdminLibraryItem> = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'description', weight: 0.2 },
    { name: 'url', weight: 0.15 },
    { name: 'source', weight: 0.1 },
    { name: 'tags', weight: 0.05 },
    { name: 'topics.label', weight: 0.05 },
    { name: 'format', weight: 0.025 },
    { name: 'difficulty', weight: 0.025 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeScore: true,
};

export function buildFuse(items: AdminLibraryItem[]): Fuse<AdminLibraryItem> {
  return new Fuse(items, FUSE_OPTIONS);
}

/**
 * Run Fuse against `items` with `query`. Returns results in Fuse-ranked order.
 * When `query` is empty, returns items unchanged (caller keeps its own sort).
 */
export function fuseFilter(
  items: AdminLibraryItem[],
  query: string,
): AdminLibraryItem[] {
  const q = query.trim();
  if (q.length < 2) return items;
  const fuse = buildFuse(items);
  return fuse.search(q).map((r) => r.item);
}
