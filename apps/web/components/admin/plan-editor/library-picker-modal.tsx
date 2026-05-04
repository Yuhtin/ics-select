'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useAdminLibrary, type AdminLibraryItem } from '../../../lib/queries/admin-library';
import { useTopics } from '../../../lib/queries/admin-topics';
import { TopicCombobox } from '../library/topic-combobox';
import {
  MultiFilterCombobox,
  type MultiFilterOption,
} from '../library/multi-filter-combobox';
import { fuseFilter } from '../../../lib/library/fuse-index';
import { BudgetBadge } from './budget-badge';
import { SectionLabel } from '../../ui/section-label';
import {
  detectPlatform,
  platformLabel,
} from '../../../lib/format/platform';

const FORMAT_OPTIONS: MultiFilterOption[] = [
  { value: 'VIDEO', label: 'Video' },
  { value: 'ARTICLE', label: 'Article' },
  { value: 'BOOK', label: 'Book' },
  { value: 'PROBLEM', label: 'Problem' },
];

const DIFFICULTY_OPTIONS: MultiFilterOption[] = [
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
];

const DIFFICULTY_RANK: Record<string, number> = { EASY: 0, MEDIUM: 1, HARD: 2 };

function sortItems(items: AdminLibraryItem[], order: Record<string, number>) {
  return [...items].sort((a, b) => {
    const aPrimary = a.topics.find((t) => t.isPrimary) ?? a.topics[0];
    const bPrimary = b.topics.find((t) => t.isPrimary) ?? b.topics[0];
    const aOrder = aPrimary ? order[aPrimary.slug] ?? 999 : 999;
    const bOrder = bPrimary ? order[bPrimary.slug] ?? 999 : 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const aDiff = DIFFICULTY_RANK[a.difficulty] ?? 9;
    const bDiff = DIFFICULTY_RANK[b.difficulty] ?? 9;
    if (aDiff !== bDiff) return aDiff - bDiff;
    return a.title.localeCompare(b.title);
  });
}

type ItemMark =
  | { kind: 'mastered' } // hide
  | { kind: 'doubts' }
  | { kind: 'stuck' }
  | { kind: 'carried-over' }
  | { kind: 'fresh' };

type MemberHistoryRow = {
  libraryItemId: string;
  lastOutcome: 'DONE_EASY' | 'DONE_HARD' | 'DOUBTS' | 'STUCK' | 'SKIPPED';
};

export interface LibraryPickerModalProps {
  open: boolean;
  onClose: () => void;
  memberTrack: string | null;
  itemsCount: number;
  plannedMinutes: number;
  budgetMinutes: number;
  selectedLibraryItemIds: Set<string>;
  carryOverLibraryItemIds: Set<string>;
  memberHistory: MemberHistoryRow[];
  onAdd: (libraryItemId: string) => void;
}

function markFor(
  libraryItemId: string,
  carryOver: Set<string>,
  historyByItem: Map<string, MemberHistoryRow['lastOutcome']>,
): ItemMark {
  const last = historyByItem.get(libraryItemId);
  // Mastered = work the member has already finished. Per isPositiveOutcome,
  // SKIPPED counts (member chose to skip because they already knew it).
  if (last === 'DONE_EASY' || last === 'DONE_HARD' || last === 'SKIPPED')
    return { kind: 'mastered' };
  if (carryOver.has(libraryItemId)) return { kind: 'carried-over' };
  if (last === 'STUCK') return { kind: 'stuck' };
  if (last === 'DOUBTS') return { kind: 'doubts' };
  return { kind: 'fresh' };
}

export function LibraryPickerModal({
  open,
  onClose,
  memberTrack,
  itemsCount,
  plannedMinutes,
  budgetMinutes,
  selectedLibraryItemIds,
  carryOverLibraryItemIds,
  memberHistory,
  onAdd,
}: LibraryPickerModalProps) {
  const { data: topics } = useTopics();
  const { data: items, isLoading } = useAdminLibrary();

  const [query, setQuery] = useState('');
  const [topicId, setTopicId] = useState<string | null>(null);
  const [formats, setFormats] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const topicOrder = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of topics ?? []) map[t.slug] = t.order;
    return map;
  }, [topics]);

  const topicCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items ?? [])
      for (const t of it.topics) m.set(t.id, (m.get(t.id) ?? 0) + 1);
    return m;
  }, [items]);

  const historyByItem = useMemo(() => {
    const m = new Map<string, MemberHistoryRow['lastOutcome']>();
    for (const row of memberHistory) m.set(row.libraryItemId, row.lastOutcome);
    return m;
  }, [memberHistory]);

  const filtered = useMemo(() => {
    let list = items ?? [];
    // Hide items the member has already mastered (DONE_EASY / DONE_HARD).
    list = list.filter(
      (i) => markFor(i.id, carryOverLibraryItemIds, historyByItem).kind !== 'mastered',
    );
    if (memberTrack) {
      list = list.filter((i) => !i.tracks || i.tracks.length === 0 || i.tracks.includes(memberTrack));
    }
    if (topicId) list = list.filter((i) => i.topics.some((t) => t.id === topicId));
    if (formats.length > 0) list = list.filter((i) => formats.includes(i.format));
    if (difficulties.length > 0) list = list.filter((i) => difficulties.includes(i.difficulty));
    if (query.trim().length >= 2) return fuseFilter(list, query);
    return sortItems(list, topicOrder);
  }, [
    items,
    memberTrack,
    topicId,
    formats,
    difficulties,
    query,
    topicOrder,
    carryOverLibraryItemIds,
    historyByItem,
  ]);

  const clearFilters = () => {
    setQuery('');
    setTopicId(null);
    setFormats([]);
    setDifficulties([]);
  };
  const anyFilterActive =
    query.length > 0 || !!topicId || formats.length > 0 || difficulties.length > 0;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/60 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-card bg-surface border border-rule shadow-modal flex flex-col max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-rule px-6 py-4">
          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="font-serif-tool text-xl font-semibold text-ink">
              Add from library
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-xs text-ink-mute tabular-nums">
                {itemsCount} items · {plannedMinutes} min
              </span>
              <BudgetBadge plannedMinutes={plannedMinutes} budgetMinutes={budgetMinutes} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-pill text-ink-mute hover:bg-paper-warm hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </header>

        <div className="border-b border-rule px-6 py-3 space-y-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-mute"
              strokeWidth={1.5}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, url, topic, format…"
              autoFocus
              className="w-full rounded-input border border-rule bg-paper px-9 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute hover:text-ink"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TopicCombobox
              topics={topics ?? []}
              counts={topicCounts}
              totalCount={items?.length ?? 0}
              value={topicId}
              onChange={setTopicId}
            />
            <MultiFilterCombobox
              label="Format"
              options={FORMAT_OPTIONS}
              value={formats}
              onChange={setFormats}
            />
            <MultiFilterCombobox
              label="Difficulty"
              options={DIFFICULTY_OPTIONS}
              value={difficulties}
              onChange={setDifficulties}
            />
            {anyFilterActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label text-ink-mute hover:text-ink"
              >
                <X className="h-3 w-3" strokeWidth={1.5} /> clear
              </button>
            )}
            <span className="ml-auto font-mono text-[10px] text-ink-mute tabular-nums">
              {filtered.length} matching
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <p className="font-mono text-xs uppercase tracking-label text-ink-mute py-8 text-center">
              Loading…
            </p>
          ) : filtered.length === 0 ? (
            <p className="font-mono text-xs text-ink-mute py-12 text-center">
              No items match. Try a shorter query or clear filters.
            </p>
          ) : (
            <>
              <SectionLabel>Items · sorted by phase → difficulty</SectionLabel>
              <ul className="mt-3 divide-y divide-rule">
                {filtered.map((item) => (
                  <PickerRow
                    key={item.id}
                    item={item}
                    selected={selectedLibraryItemIds.has(item.id)}
                    mark={markFor(item.id, carryOverLibraryItemIds, historyByItem)}
                    onAdd={() => onAdd(item.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>

        <footer className="border-t border-rule px-6 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill hover:opacity-90"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}

// Tailwind class map for the + circle, keyed by the picker mark. Tokens
// already exist in design-system.md (--outcome-stuck/doubts, --accent for
// carried-over).
const PLUS_STYLES: Record<ItemMark['kind'], { ring: string; label: string | null }> = {
  fresh: { ring: 'border-rule text-ink-mute', label: null },
  'carried-over': {
    ring: 'border-accent text-accent bg-accent/10',
    label: 'carried over',
  },
  doubts: {
    ring: 'border-outcome-doubts text-outcome-doubts bg-outcome-doubts/10',
    label: 'had doubts',
  },
  stuck: {
    ring: 'border-outcome-stuck text-outcome-stuck bg-outcome-stuck/10',
    label: 'stuck',
  },
  mastered: { ring: 'border-rule text-ink-mute', label: null }, // never rendered (filtered out)
};

function PickerRow({
  item,
  selected,
  mark,
  onAdd,
}: {
  item: AdminLibraryItem;
  selected: boolean;
  mark: ItemMark;
  onAdd: () => void;
}) {
  const platform = detectPlatform(item.url ?? null, item.format);
  const primary = item.topics.find((t) => t.isPrimary) ?? item.topics[0] ?? null;
  const plus = PLUS_STYLES[mark.kind];
  return (
    <li>
      <button
        type="button"
        onClick={onAdd}
        disabled={selected}
        className={clsx(
          'w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors',
          selected ? 'opacity-60 cursor-default' : 'hover:bg-paper-warm',
        )}
      >
        <span
          title={!selected && plus.label ? plus.label : undefined}
          className={clsx(
            'mt-0.5 grid h-6 w-6 place-items-center rounded-pill shrink-0 border',
            selected
              ? 'border-outcome-done-easy text-outcome-done-easy bg-outcome-done-easy/10'
              : plus.ring,
          )}
        >
          {selected ? <Check className="h-3 w-3" strokeWidth={2} /> : <Plus className="h-3 w-3" strokeWidth={2} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-serif-tool text-sm font-semibold text-ink truncate">
              {item.title}
            </p>
            {!selected && plus.label && (
              <span
                className={clsx(
                  'font-mono text-[9px] uppercase tracking-label px-1.5 py-0.5 rounded-pill border',
                  mark.kind === 'carried-over' && 'border-accent/40 text-accent',
                  mark.kind === 'doubts' && 'border-outcome-doubts/40 text-outcome-doubts',
                  mark.kind === 'stuck' && 'border-outcome-stuck/40 text-outcome-stuck',
                )}
              >
                {plus.label}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-ink-mute flex-wrap">
            <span>{platformLabel(platform)}</span>
            {primary && (
              <>
                <span>·</span>
                <span>{primary.label}</span>
              </>
            )}
            <span>·</span>
            <span>{item.difficulty.toLowerCase()}</span>
            <span>·</span>
            <span className="tabular-nums">{item.estimatedMinutes}m</span>
          </div>
        </div>
      </button>
    </li>
  );
}
