'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Layers, Search, X } from 'lucide-react';
import {
  useAdminLibrary,
  useDeleteLibraryItem,
  type AdminLibraryItem,
} from '../../../../lib/queries/admin-library';
import { useTopics } from '../../../../lib/queries/admin-topics';
import { useAuth } from '../../../../lib/auth/auth-context';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { ItemFormModal } from '../../../../components/admin/library/item-form-modal';
import { TopicsModal } from '../../../../components/admin/library/topics-modal';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { TopicCombobox } from '../../../../components/admin/library/topic-combobox';
import {
  MultiFilterCombobox,
  type MultiFilterOption,
} from '../../../../components/admin/library/multi-filter-combobox';
import { LibraryShelf } from '../../../../components/library/library-shelf';
import { LibraryGrid } from '../../../../components/library/library-grid';
import type { Capability } from '../../../../components/library/library-card';
import { fuseFilter } from '../../../../lib/library/fuse-index';
import { PHASES, topicPhase, type PhaseKey } from '../../../../lib/topics/phase';

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

function parseCsv(v: string | null): string[] {
  if (!v) return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

const DIFFICULTY_RANK: Record<string, number> = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2,
};

// Learning order within a shelf / grid: primary Topic.order (pedagogical
// sequence across topics) → per-topic LibraryItemTopic.order (manual
// pedagogical ordering, NULLS LAST) → EASY → MEDIUM → HARD ladder →
// title A-Z as final tiebreaker.
function sortLibraryItems(
  items: AdminLibraryItem[],
  order: Record<string, number>,
  focusedTopicId: string | null = null,
): AdminLibraryItem[] {
  // When a topic filter is active, use the per-item order under THAT topic
  // (cross-topic items can have different orders in different topics).
  // Unfocused, fall back to the primary topic's order.
  const topicRow = (item: AdminLibraryItem) =>
    focusedTopicId
      ? item.topics.find((t) => t.id === focusedTopicId) ??
        item.topics.find((t) => t.isPrimary) ??
        item.topics[0]
      : item.topics.find((t) => t.isPrimary) ?? item.topics[0];
  return [...items].sort((a, b) => {
    const aRow = topicRow(a);
    const bRow = topicRow(b);
    const aOrder = aRow ? order[aRow.slug] ?? 999 : 999;
    const bOrder = bRow ? order[bRow.slug] ?? 999 : 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const aManual = aRow?.order ?? null;
    const bManual = bRow?.order ?? null;
    if (aManual !== bManual) {
      if (aManual === null) return 1;
      if (bManual === null) return -1;
      return aManual - bManual;
    }
    const aDiff = DIFFICULTY_RANK[a.difficulty] ?? 9;
    const bDiff = DIFFICULTY_RANK[b.difficulty] ?? 9;
    if (aDiff !== bDiff) return aDiff - bDiff;
    return a.title.localeCompare(b.title);
  });
}

function groupByPhase(items: AdminLibraryItem[], order: Record<string, number>) {
  const byPhase = new Map<PhaseKey, AdminLibraryItem[]>();
  for (const item of items) {
    const primary = item.topics.find((t) => t.isPrimary) ?? item.topics[0];
    if (!primary) continue;
    const itemOrder = order[primary.slug];
    if (itemOrder === undefined) continue;
    const phase = topicPhase(itemOrder);
    const bucket = byPhase.get(phase);
    if (bucket) bucket.push(item);
    else byPhase.set(phase, [item]);
  }
  return PHASES.map((p) => ({
    ...p,
    items: byPhase.get(p.key) ?? [],
  })).filter((p) => p.items.length > 0);
}

export default function AdminLibraryPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const capability: Capability = user?.role === 'ADMIN' ? 'edit' : 'view';

  const { data: topics } = useTopics();
  const { data: items, isLoading } = useAdminLibrary();

  const query = params.get('q') ?? '';
  const topicId = params.get('topic');
  const formats = parseCsv(params.get('format'));
  const difficulties = parseCsv(params.get('difficulty'));
  const tracks = parseCsv(params.get('track'));

  const [searchInput, setSearchInput] = useState(query);
  useEffect(() => setSearchInput(query), [query]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== query) writeUrl({ q: searchInput });
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
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
    // Dropping page param on any filter change.
    sp.delete('page');
    router.replace(`?${sp.toString()}`);
  }

  const allItems = items ?? [];

  const topicOrder = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of topics ?? []) map[t.slug] = t.order;
    return map;
  }, [topics]);

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
        if (!i.tracks || i.tracks.length === 0) return true;
        return i.tracks.some((t) => tracks.includes(t));
      });
    }
    // Search relevance wins over learning order — only sort when not searching.
    if (query.trim().length >= 2) return fuseFilter(list, query);
    return sortLibraryItems(list, topicOrder, topicId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allItems,
    topicId,
    formats.join(','),
    difficulties.join(','),
    tracks.join(','),
    query,
    topicOrder,
  ]);

  const topicCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of allItems)
      for (const t of it.topics) {
        m.set(t.id, (m.get(t.id) ?? 0) + 1);
      }
    return m;
  }, [allItems]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminLibraryItem | null>(null);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminLibraryItem | null>(null);
  const remove = useDeleteLibraryItem();

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
  const removeItem = (item: AdminLibraryItem) => {
    setDeleteTarget(item);
  };
  const confirmRemove = () => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, {
      onSettled: () => setDeleteTarget(null),
    });
  };

  const anyFilterActive =
    query.length > 0 ||
    !!topicId ||
    formats.length > 0 ||
    difficulties.length > 0 ||
    tracks.length > 0;

  const clearAll = () => {
    setSearchInput('');
    router.replace('?');
  };

  const showShelves = !anyFilterActive;
  const phaseGroups = useMemo(
    () => (showShelves ? groupByPhase(filtered, topicOrder) : []),
    [showShelves, filtered, topicOrder],
  );

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Library</Eyebrow>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
            Acervo
          </h1>
          <p className="mt-1 font-mono text-xs text-fg-mute">
            {anyFilterActive
              ? `${filtered.length} of ${allItems.length} matching`
              : `${allItems.length} item${allItems.length === 1 ? '' : 's'} · ${phaseGroups.length} phases`}
          </p>
        </div>
        {capability === 'edit' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTopicsOpen(true)}
              className="inline-flex items-center gap-2 rounded-pill bg-bg-subtle px-4 py-2 font-mono text-xs uppercase tracking-label text-fg-soft hover:bg-border-token"
            >
              <Layers className="h-3.5 w-3.5" strokeWidth={1.5} /> Manage topics
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-pill bg-fg px-4 py-2 font-mono text-xs uppercase tracking-label text-bg hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> New item
            </button>
          </div>
        )}
      </header>

      <div className="space-y-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-mute"
            strokeWidth={1.5}
          />
          <input
            id="library-search-input"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search title, url, topic, format… (press / to focus)"
            className="w-full rounded-input border border-border-token bg-surface px-9 py-2.5 font-sans text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-mute hover:text-fg"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TopicCombobox
            topics={topics ?? []}
            counts={topicCounts}
            totalCount={allItems.length}
            value={topicId}
            onChange={(id) => writeUrl({ topic: id })}
          />
          <MultiFilterCombobox
            label="Format"
            options={FORMAT_OPTIONS}
            value={formats}
            onChange={(v) => writeUrl({ format: v })}
          />
          <MultiFilterCombobox
            label="Difficulty"
            options={DIFFICULTY_OPTIONS}
            value={difficulties}
            onChange={(v) => writeUrl({ difficulty: v })}
          />
          <MultiFilterCombobox
            label="Track"
            options={TRACK_OPTIONS}
            value={tracks}
            onChange={(v) => writeUrl({ track: v })}
          />
          {anyFilterActive && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label text-fg-mute hover:text-fg"
            >
              <X className="h-3 w-3" strokeWidth={1.5} /> clear all
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="font-mono text-xs uppercase tracking-label text-fg-mute">
          Loading…
        </p>
      ) : filtered.length === 0 ? (
        <div className="space-y-3 rounded-card border border-dashed border-border-token py-16 text-center font-mono text-xs text-fg-mute">
          <p>No items match.</p>
          {anyFilterActive && (
            <button
              type="button"
              onClick={clearAll}
              className="font-mono text-[11px] uppercase tracking-label text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : showShelves ? (
        <div className="space-y-2">
          {phaseGroups.map((phase) => (
            <LibraryShelf
              key={phase.key}
              label={phase.label}
              items={phase.items}
              capability={capability}
              onEdit={capability === 'edit' ? openEdit : undefined}
              onDelete={capability === 'edit' ? removeItem : undefined}
            />
          ))}
        </div>
      ) : (
        <LibraryGrid
          items={filtered}
          capability={capability}
          onEdit={capability === 'edit' ? openEdit : undefined}
          onDelete={capability === 'edit' ? removeItem : undefined}
        />
      )}

      <ItemFormModal open={formOpen} initial={editing} onClose={closeForm} />
      <TopicsModal open={topicsOpen} onClose={() => setTopicsOpen(false)} />
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => {
          if (!remove.isPending) setDeleteTarget(null);
        }}
        onConfirm={confirmRemove}
        title="Delete library item?"
        description={
          deleteTarget ? (
            <>
              Delete <span className="font-semibold text-ink">{deleteTarget.title}</span>? Members
              still finish items they already had in active plans.
            </>
          ) : null
        }
        confirmLabel="Delete"
        isLoading={remove.isPending}
      />
    </div>
  );
}
