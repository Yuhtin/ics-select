'use client';
import { useEffect, useState } from 'react';
import { useLibrarySearch } from '../../../lib/queries/library-search';

export function AddItemTypeahead({
  memberTrack,
  onAdd,
  excludeIds,
}: {
  memberTrack: string | null;
  onAdd: (libraryItemId: string) => void;
  excludeIds: Set<string>;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [focus, setFocus] = useState(false);
  const { data } = useLibrarySearch(
    debounced,
    memberTrack ? { tracks: [memberTrack] } : undefined,
  );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const results =
    data?.data?.filter((i) => !excludeIds.has(i.id)).slice(0, 8) ?? [];

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        placeholder="+ Add from library — type to search…"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        className="w-full rounded-input border border-rule bg-paper px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
      />
      {focus && debounced.length >= 2 && (
        <ul className="absolute left-0 right-0 top-full mt-1 max-h-80 overflow-auto rounded-card border border-rule bg-surface z-10 shadow-lift">
          {results.length > 0 ? (
            results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onAdd(item.id);
                    setQuery('');
                    setDebounced('');
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-paper-warm border-b border-rule last:border-0"
                >
                  <p className="font-serif-tool text-sm font-semibold text-ink truncate">
                    {item.title}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                    {item.format} · {item.estimatedMinutes}m
                  </p>
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-3 font-mono text-[11px] text-ink-mute">
              No matches — try a shorter query or add items to the library.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
