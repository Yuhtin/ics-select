'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Layers, Pencil, Trash2, Search } from 'lucide-react';
import {
  useAdminLibrary,
  useDeleteLibraryItem,
  type AdminLibraryItem,
} from '../../../../lib/queries/admin-library';
import { useTopics } from '../../../../lib/queries/admin-topics';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { ItemFormModal } from '../../../../components/admin/library/item-form-modal';
import { TopicsModal } from '../../../../components/admin/library/topics-modal';
import { TopicCombobox } from '../../../../components/admin/library/topic-combobox';
import {
  MultiFilterCombobox,
  type MultiFilterOption,
} from '../../../../components/admin/library/multi-filter-combobox';
import { Pagination } from '../../../../components/admin/library/pagination';
import { fuseFilter } from '../../../../lib/library/fuse-index';
import { topicCategory } from '../../../../lib/format/topic-category';
import {
  detectPlatform,
  platformLabel,
} from '../../../../lib/format/platform';

const PAGE_SIZE = 25;

const FORMAT_OPTIONS: MultiFilterOption[] = [
  { value: 'VIDEO', label: 'Video' },
  { value: 'ARTICLE', label: 'Article' },
  { value: 'BOOK', label: 'Book' },
  { value: 'PROBLEM', label: 'Problem' },
  { value: 'OTHER', label: 'Other' },
];

const DIFFICULTY_OPTIONS: MultiFilterOption[] = [
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
];

const TRACK_OPTIONS: MultiFilterOption[] = [
  { value: 'BIG_TECH', label: 'Big Tech' },
  { value: 'CONSULTING_TECH', label: 'Consulting tech' },
  { value: 'COMPETITIVE_PROGRAMMING', label: 'Competitive' },
  { value: 'STARTUP', label: 'Startup' },
  { value: 'OTHER', label: 'Other' },
];

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

function parseCsv(v: string | null): string[] {
  if (!v) return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export default function AdminLibraryPage() {
  const router = useRouter();
  const params = useSearchParams();

  const { data: topics } = useTopics();
  const { data: items, isLoading } = useAdminLibrary();

  // URL-driven state (read once per render).
  const query = params.get('q') ?? '';
  const topicId = params.get('topic');
  const formats = parseCsv(params.get('format'));
  const difficulties = parseCsv(params.get('difficulty'));
  const tracks = parseCsv(params.get('track'));
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);

  // Local-only state: search input is debounced before it syncs to URL.
  const [searchInput, setSearchInput] = useState(query);
  useEffect(() => setSearchInput(query), [query]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== query) writeUrl({ q: searchInput, page: 1 });
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // `/` shortcut focuses the search input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA') {
        const el = document.getElementById('library-search-input');
        if (el) {
          e.preventDefault();
          (el as HTMLInputElement).focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function writeUrl(next: {
    q?: string;
    topic?: string | null;
    format?: string[];
    difficulty?: string[];
    track?: string[];
    page?: number;
  }) {
    const sp = new URLSearchParams(params.toString());
    const setOrDelete = (k: string, v: string | null | undefined) => {
      if (v && v.length > 0) sp.set(k, v);
      else sp.delete(k);
    };
    if ('q' in next) setOrDelete('q', next.q);
    if ('topic' in next) setOrDelete('topic', next.topic);
    if ('format' in next) setOrDelete('format', next.format!.join(','));
    if ('difficulty' in next) setOrDelete('difficulty', next.difficulty!.join(','));
    if ('track' in next) setOrDelete('track', next.track!.join(','));
    if ('page' in next) {
      if (!next.page || next.page === 1) sp.delete('page');
      else sp.set('page', String(next.page));
    }
    router.replace(`?${sp.toString()}`);
  }

  // ----- Filter pipeline -----
  const allItems = items ?? [];

  const filtered = useMemo(() => {
    let list = allItems;
    if (topicId) {
      list = list.filter((i) => i.topics.some((t) => t.id === topicId));
    }
    if (formats.length > 0) list = list.filter((i) => formats.includes(i.format));
    if (difficulties.length > 0) {
      list = list.filter((i) => difficulties.includes(i.difficulty));
    }
    if (tracks.length > 0) {
      list = list.filter((i) => {
        // Empty tracks[] = wildcard (applies everywhere).
        if (!i.tracks || i.tracks.length === 0) return true;
        return i.tracks.some((t) => tracks.includes(t));
      });
    }
    if (query.trim().length >= 2) list = fuseFilter(list, query);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, topicId, formats.join(','), difficulties.join(','), tracks.join(','), query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Topic counts (unconditional — reflect total per topic).
  const topicCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of allItems) for (const t of it.topics) {
      m.set(t.id, (m.get(t.id) ?? 0) + 1);
    }
    return m;
  }, [allItems]);

  // Breadcrumb context.
  const activeTopic = topicId ? (topics ?? []).find((t) => t.id === topicId) : null;
  const activeCategory = activeTopic ? topicCategory(activeTopic.order) : null;

  // Handlers
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminLibraryItem | null>(null);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const remove = useDeleteLibraryItem();

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (item: AdminLibraryItem) => { setEditing(item); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); };
  const removeItem = (item: AdminLibraryItem) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    remove.mutate(item.id);
  };

  const anyFilterActive =
    query.length > 0 || topicId || formats.length > 0 ||
    difficulties.length > 0 || tracks.length > 0;

  const clearAll = () => {
    setSearchInput('');
    router.replace('?');
  };

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Eyebrow>Library</Eyebrow>
          <h1 className="mt-2 font-serif-tool text-3xl font-semibold tracking-tight">
            {activeTopic ? (
              <span>
                Library
                <span className="text-ink-mute"> · {activeCategory} / </span>
                {activeTopic.label}
              </span>
            ) : (
              'Library'
            )}
          </h1>
          <p className="mt-1 font-mono text-xs text-ink-mute">
            {anyFilterActive
              ? `${filtered.length} of ${allItems.length} · showing ${pageItems.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + pageItems.length}`
              : `${allItems.length} item${allItems.length === 1 ? '' : 's'}`}
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

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-mute"
          strokeWidth={1.5}
        />
        <input
          id="library-search-input"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search title, url, topic, format…"
          className="w-full rounded-input border border-rule bg-paper pl-9 pr-4 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
        />
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        <TopicCombobox
          topics={topics ?? []}
          counts={topicCounts}
          totalCount={allItems.length}
          value={topicId}
          onChange={(id) => writeUrl({ topic: id, page: 1 })}
        />
        <MultiFilterCombobox
          label="Format"
          options={FORMAT_OPTIONS}
          value={formats}
          onChange={(v) => writeUrl({ format: v, page: 1 })}
        />
        <MultiFilterCombobox
          label="Difficulty"
          options={DIFFICULTY_OPTIONS}
          value={difficulties}
          onChange={(v) => writeUrl({ difficulty: v, page: 1 })}
        />
        <MultiFilterCombobox
          label="Track"
          options={TRACK_OPTIONS}
          value={tracks}
          onChange={(v) => writeUrl({ track: v, page: 1 })}
        />
        {anyFilterActive && (
          <button
            type="button"
            onClick={clearAll}
            className="font-mono text-[10px] uppercase tracking-label text-ink-mute hover:text-ink"
          >
            ✕ clear all
          </button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <p className="font-mono text-xs uppercase tracking-label text-ink-mute">
          Loading…
        </p>
      ) : pageItems.length === 0 ? (
        <div className="font-mono text-xs text-ink-mute py-12 text-center border border-dashed border-rule rounded-card space-y-3">
          <p>No items match.</p>
          {anyFilterActive && (
            <button
              type="button"
              onClick={clearAll}
              className="font-mono text-[11px] uppercase tracking-label text-focus hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {pageItems.map((item) => {
            const platform = detectPlatform(item.url ?? null, item.format);
            const primaryTopic = item.topics.find((t) => t.isPrimary) ?? null;
            const borderClass = PLATFORM_BORDER[platform] ?? 'border-l-rule';
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
                    {primaryTopic && (
                      <>
                        <span>·</span>
                        <span>{primaryTopic.label}</span>
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

      {/* Pagination */}
      <Pagination
        page={safePage}
        totalPages={totalPages}
        onChange={(p) => writeUrl({ page: p })}
      />

      <ItemFormModal
        open={formOpen}
        initial={editing}
        onClose={closeForm}
      />
      <TopicsModal open={topicsOpen} onClose={() => setTopicsOpen(false)} />
    </div>
  );
}
