'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';
import { clsx } from 'clsx';
import type { Topic } from '../../../lib/queries/admin-topics';
import { groupTopicsByCategory } from '../../../lib/format/topic-category';

interface Props {
  topics: Topic[];
  counts: Map<string, number>; // topicId → item count
  totalCount: number;
  value: string | null; // topicId
  onChange: (next: string | null) => void;
}

export function TopicCombobox({ topics, counts, totalCount, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFilter('');
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const grouped = useMemo(() => {
    if (!filter.trim()) return groupTopicsByCategory(topics);
    const q = filter.toLowerCase();
    const matched = topics.filter((t) => t.label.toLowerCase().includes(q));
    return groupTopicsByCategory(matched);
  }, [topics, filter]);

  const activeTopic = value ? topics.find((t) => t.id === value) : null;
  const triggerLabel = activeTopic ? activeTopic.label : 'All topics';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-label px-3 py-1.5 rounded-pill border transition-colors',
          value
            ? 'bg-paper-warm border-ink text-ink'
            : 'bg-paper border-rule text-ink-soft hover:bg-paper-warm',
        )}
      >
        {triggerLabel}
        {value ? (
          <X
            className="h-3 w-3"
            strokeWidth={1.5}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
          />
        ) : (
          <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
        )}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-80 rounded-card border border-rule bg-surface shadow-sm">
          <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
            <Search className="h-3.5 w-3.5 text-ink-mute" strokeWidth={1.5} />
            <input
              ref={inputRef}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter topics…"
              className="w-full bg-transparent font-sans text-sm focus:outline-none"
            />
          </div>
          <div className="max-h-96 overflow-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={clsx(
                'flex w-full items-center justify-between px-3 py-1.5 font-sans text-sm',
                !value ? 'bg-focus/5 text-ink' : 'text-ink-soft hover:bg-paper-warm',
              )}
            >
              <span className="flex items-center gap-2">
                {!value && <Check className="h-3.5 w-3.5" strokeWidth={1.5} />}
                <span className={!value ? '' : 'pl-5'}>All topics</span>
              </span>
              <span className="font-mono text-[11px] text-ink-mute">
                ({totalCount})
              </span>
            </button>
            {grouped.map(({ category, topics: ts }) => (
              <div key={category}>
                <div className="px-3 pt-2 pb-1 font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute">
                  {category}
                </div>
                {ts.map((t) => {
                  const active = value === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onChange(t.id);
                        setOpen(false);
                      }}
                      className={clsx(
                        'flex w-full items-center justify-between px-3 py-1.5 font-sans text-sm',
                        active ? 'bg-focus/5 text-ink' : 'text-ink-soft hover:bg-paper-warm',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {active && <Check className="h-3.5 w-3.5" strokeWidth={1.5} />}
                        <span className={active ? '' : 'pl-5'}>{t.label}</span>
                      </span>
                      <span className="font-mono text-[11px] text-ink-mute">
                        ({counts.get(t.id) ?? 0})
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            {grouped.length === 0 && (
              <p className="px-3 py-3 font-mono text-[11px] text-ink-mute">
                No topics match.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
