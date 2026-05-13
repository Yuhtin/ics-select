'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, CircleAlert, Users, X } from 'lucide-react';
import type { Lesson, LessonNode } from './lesson-types';
import { GROUP_META } from './group-meta';
import { Eyebrow } from '../../ui/eyebrow';

export function LiveMode({ lesson }: { lesson: Lesson }) {
  const beats = useMemo(
    () =>
      lesson.nodes
        .filter((n): n is LessonNode & { beat: number } => typeof n.beat === 'number')
        .sort((a, b) => a.beat - b.beat),
    [lesson],
  );

  const [index, setIndex] = useState(0);
  const node = beats[index];

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.max(0, Math.min(beats.length - 1, i + delta)));
    },
    [beats.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /input|textarea/i.test(e.target.tagName)) {
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'j' || e.key === ' ') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'k') {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  if (!node) return null;

  return (
    <div className="space-y-8">
      <BeatStepper beats={beats} activeIndex={index} onSelect={setIndex} />

      <AnimatePresence mode="wait">
        <motion.div
          key={node.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <FocusCard node={node} />
        </motion.div>
      </AnimatePresence>

      <BeatNav
        beats={beats}
        index={index}
        onPrev={() => go(-1)}
        onNext={() => go(1)}
      />
    </div>
  );
}

function BeatStepper({
  beats,
  activeIndex,
  onSelect,
}: {
  beats: (LessonNode & { beat: number })[];
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <ol className="flex min-w-max items-stretch gap-1.5">
        {beats.map((b, i) => {
          const meta = GROUP_META[b.group];
          const active = i === activeIndex;
          const passed = i < activeIndex;
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                className={clsx(
                  'group flex w-[126px] flex-col items-start gap-1.5 rounded-card border px-3 py-2.5 text-left transition-all',
                  active
                    ? 'border-fg bg-surface shadow-sm'
                    : passed
                      ? 'border-border-token bg-bg-subtle/60 hover:border-border-strong'
                      : 'border-border-token bg-surface hover:border-border-strong',
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className={clsx(
                      'font-mono text-[10px] font-bold uppercase tracking-eyebrow',
                      active ? 'text-fg' : 'text-fg-mute',
                    )}
                  >
                    Beat {b.beat}
                  </span>
                  <span className={clsx('h-1.5 w-1.5 rounded-full', meta.ringClass)} />
                </div>
                <p
                  className={clsx(
                    'line-clamp-2 font-sans text-[11px] leading-tight',
                    active ? 'text-fg' : 'text-fg-mute',
                  )}
                >
                  {b.label}
                </p>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function FocusCard({ node }: { node: LessonNode }) {
  const meta = GROUP_META[node.group];
  return (
    <article className="overflow-hidden rounded-card border border-border-token bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border-token bg-bg-subtle/40 px-7 py-4">
        <div className="flex items-center gap-3">
          <span className={clsx('h-2 w-2 rounded-full', meta.ringClass)} />
          <Eyebrow>
            {meta.eyebrow}
            {typeof node.beat === 'number' && (
              <span className={clsx('ml-2', meta.accentClass)}>· beat #{node.beat}</span>
            )}
          </Eyebrow>
        </div>
        <h2 className="font-serif text-xl font-semibold text-fg">{node.label}</h2>
      </header>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:divide-x lg:divide-border-token">
        <div className="space-y-7 px-7 py-7">
          <div>
            <Eyebrow className="mb-3">Pergunta-âncora</Eyebrow>
            <p className="font-serif text-2xl leading-snug text-fg lg:text-[26px]">
              "{node.anchor}"
            </p>
            <p className="mt-4 font-serif italic text-fg-soft">{node.oneLine}</p>
          </div>

          <div>
            <Eyebrow className="mb-3">Pra quem perguntar</Eyebrow>
            <div className="flex flex-col gap-2.5">
              {node.askWho.map((a, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-input border border-border-token bg-bg-subtle/50 p-3"
                >
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-fg-soft">
                    <Users className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-sm font-semibold leading-tight text-fg">
                      {a.name === 'open' ? 'Pergunta aberta ao grupo' : a.name}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-fg-soft">
                      {a.why}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5 px-7 py-7">
          <PegadinhasList node={node} />

          <div className="rounded-input border border-warn/30 bg-warn-soft/40 p-4">
            <Eyebrow className="mb-2 text-warn">
              <CircleAlert className="-mt-0.5 mr-1 inline h-3 w-3" strokeWidth={2} />
              Provocação
            </Eyebrow>
            <p className="text-sm leading-relaxed text-fg">{node.gotcha}</p>
          </div>

          <div className="rounded-input border border-border-token bg-bg-subtle/50 p-4">
            <Eyebrow className="mb-2">Pergunta-ponte</Eyebrow>
            <p className="flex items-start gap-2 text-sm leading-relaxed text-fg">
              <ArrowRight
                className="mt-1 h-4 w-4 shrink-0 text-fg-faint"
                strokeWidth={1.8}
              />
              {node.followup}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function PegadinhasList({ node }: { node: LessonNode }) {
  const top = node.pass3.slice(0, 3);
  if (top.length === 0) return null;
  return (
    <div>
      <Eyebrow className="mb-3">Pegadinhas (5s scan)</Eyebrow>
      <ul className="space-y-2.5">
        {top.map((p, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
              <X className="h-3 w-3" strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-sans text-[13px] font-semibold leading-tight text-fg">
                {p.gotcha}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-fg-soft">{p.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BeatNav({
  beats,
  index,
  onPrev,
  onNext,
}: {
  beats: (LessonNode & { beat: number })[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const prev = index > 0 ? beats[index - 1] : undefined;
  const next = index < beats.length - 1 ? beats[index + 1] : undefined;
  return (
    <div className="flex items-stretch justify-between gap-3 border-t border-border-token pt-5">
      <button
        type="button"
        onClick={onPrev}
        disabled={!prev}
        className={clsx(
          'group flex max-w-[260px] flex-1 items-start gap-3 rounded-input border border-border-token px-4 py-3 text-left transition-colors',
          prev
            ? 'bg-surface hover:border-border-strong'
            : 'cursor-not-allowed border-transparent opacity-40',
        )}
      >
        <ArrowLeft className="mt-0.5 h-4 w-4 text-fg-faint" strokeWidth={1.8} />
        <div className="min-w-0">
          <Eyebrow>Previous</Eyebrow>
          <p className="mt-1 font-sans text-sm text-fg">
            {prev ? prev.label : '—'}
          </p>
        </div>
      </button>

      <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute sm:flex">
        <kbd className="rounded border border-border-token bg-surface px-1.5 py-0.5 text-[10px]">
          ←
        </kbd>
        <kbd className="rounded border border-border-token bg-surface px-1.5 py-0.5 text-[10px]">
          →
        </kbd>
        navegar
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!next}
        className={clsx(
          'group flex max-w-[260px] flex-1 items-start justify-end gap-3 rounded-input border border-border-token px-4 py-3 text-right transition-colors',
          next
            ? 'bg-fg text-bg hover:bg-fg/90'
            : 'cursor-not-allowed border-transparent opacity-40',
        )}
      >
        <div className="min-w-0">
          <Eyebrow className={next ? 'text-bg/70' : ''}>Next</Eyebrow>
          <p className="mt-1 font-sans text-sm">{next ? next.label : '—'}</p>
        </div>
        <ArrowRight
          className={clsx('mt-0.5 h-4 w-4', next ? 'text-bg' : 'text-fg-faint')}
          strokeWidth={1.8}
        />
      </button>
    </div>
  );
}

