'use client';
import { useEffect, useState } from 'react';
import { Plus, Layers, Pencil, Trash2 } from 'lucide-react';
import {
  useAdminLibrarySearch,
  useDeleteLibraryItem,
  type AdminLibraryItem,
} from '../../../../lib/queries/admin-library';
import { useTopics } from '../../../../lib/queries/admin-topics';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import {
  FiltersBar,
  type FiltersState,
} from '../../../../components/admin/library/filters-bar';
import { ItemFormModal } from '../../../../components/admin/library/item-form-modal';
import { TopicsModal } from '../../../../components/admin/library/topics-modal';
import {
  detectPlatform,
  platformLabel,
} from '../../../../lib/format/platform';

const PLATFORM_BORDER: Record<string, string> = {
  youtube: 'border-l-platform-youtube',
  leetcode: 'border-l-platform-leetcode',
  medium: 'border-l-platform-medium',
  github: 'border-l-platform-github',
  article: 'border-l-platform-article',
  book: 'border-l-platform-book',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function AdminLibraryPage() {
  const { data: topics } = useTopics();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<FiltersState>({
    format: [],
    difficulty: [],
    tracks: [],
    topicId: null,
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminLibraryItem | null>(null);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const remove = useDeleteLibraryItem();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const searchParams = {
    query: debouncedSearch || undefined,
    format: filters.format.length > 0 ? filters.format : undefined,
    difficulty: filters.difficulty.length > 0 ? filters.difficulty : undefined,
    tracks: filters.tracks.length > 0 ? filters.tracks : undefined,
    topicId: filters.topicId ?? undefined,
  };
  const { data, isLoading } = useAdminLibrarySearch(searchParams);

  const items = data?.data ?? [];

  const removeItem = (item: AdminLibraryItem) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    remove.mutate(item.id);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (item: AdminLibraryItem) => {
    setEditing(item);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Eyebrow>Library</Eyebrow>
          <h1 className="mt-2 font-serif-tool text-3xl font-semibold tracking-tight">
            Library
          </h1>
          <p className="mt-1 font-mono text-xs text-ink-mute">
            {items.length} item{items.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTopicsOpen(true)}
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-label px-4 py-2 bg-paper-warm text-ink-soft rounded-pill hover:bg-rule"
          >
            <Layers className="h-3.5 w-3.5" strokeWidth={1.5} /> Manage topics
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> New item
          </button>
        </div>
      </div>

      <div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search library…"
          className="w-full rounded-input border border-rule bg-paper px-4 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
        />
      </div>

      <FiltersBar
        topics={topics ?? []}
        value={filters}
        onChange={setFilters}
      />

      {isLoading ? (
        <p className="font-mono text-xs uppercase tracking-label text-ink-mute">
          Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="font-mono text-xs text-ink-mute py-12 text-center border border-dashed border-rule rounded-card">
          No items match.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const platform = detectPlatform(item.url ?? null, item.format);
            const topicLabel = item.topicId
              ? ((topics ?? []).find((t) => t.id === item.topicId)?.label ??
                null)
              : null;
            const borderClass =
              PLATFORM_BORDER[platform] ?? 'border-l-rule';
            return (
              <li
                key={item.id}
                className={`group flex items-start gap-3 border border-rule border-l-[3px] ${borderClass} rounded-card bg-surface px-4 py-3 hover:bg-paper-warm/60 transition-colors`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-serif-tool text-base font-semibold text-ink">
                    {item.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap font-mono text-[10px] uppercase tracking-label text-ink-mute">
                    <span>{platformLabel(platform)}</span>
                    {topicLabel && (
                      <>
                        <span>·</span>
                        <span>{topicLabel}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{item.format}</span>
                    <span>·</span>
                    <span>{item.difficulty.toLowerCase()}</span>
                    <span>·</span>
                    <span>{item.estimatedMinutes}m</span>
                    {item.tracks.length > 0 && (
                      <>
                        <span>·</span>
                        <span>
                          {item.tracks
                            .map((t) => t.replace(/_/g, ' ').toLowerCase())
                            .join(', ')}
                        </span>
                      </>
                    )}
                    <span>·</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 font-mono text-[11px]">
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-focus hover:underline"
                    >
                      open ↗
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="text-ink-soft hover:text-ink inline-flex items-center gap-1"
                  >
                    <Pencil className="h-3 w-3" strokeWidth={1.5} /> edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    className="text-ink-soft hover:text-outcome-stuck inline-flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.5} /> delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ItemFormModal
        open={formOpen}
        initial={editing}
        onClose={closeForm}
      />
      <TopicsModal open={topicsOpen} onClose={() => setTopicsOpen(false)} />
    </div>
  );
}
