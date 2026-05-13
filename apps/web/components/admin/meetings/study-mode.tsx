'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowRight, Users } from 'lucide-react';
import type { Lesson, LessonNode } from './lesson-types';
import { GROUP_META } from './group-meta';
import { Eyebrow } from '../../ui/eyebrow';

type Pass = 'overview' | 'deep' | 'mastery';

const PASS_LABELS: Record<Pass, { label: string; sublabel: string }> = {
  overview: { label: 'Overview', sublabel: '~30 min · nomeia tudo' },
  deep: { label: 'Deep dive', sublabel: '~2 h · prepara pra ensinar' },
  mastery: { label: 'Mastery', sublabel: '~1 h · pegadinhas' },
};

export function StudyMode({ lesson }: { lesson: Lesson }) {
  const [activeId, setActiveId] = useState<string>(lesson.nodes[0]?.id ?? '');
  const [pass, setPass] = useState<Pass>('overview');

  useEffect(() => {
    const ids = lesson.nodes.map((n) => n.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(`node-${id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [lesson]);

  return (
    <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <SidebarNav lesson={lesson} activeId={activeId} />
      </aside>

      <div className="min-w-0 space-y-12">
        <PassSwitcher pass={pass} onChange={setPass} />
        <div className="space-y-16">
          {lesson.nodes.map((node) => (
            <NodeSection key={node.id} node={node} pass={pass} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SidebarNav({
  lesson,
  activeId,
}: {
  lesson: Lesson;
  activeId: string;
}) {
  const grouped = lesson.nodes.reduce<Record<string, LessonNode[]>>((acc, n) => {
    (acc[n.group] = acc[n.group] ?? []).push(n);
    return acc;
  }, {});

  const order: (keyof typeof GROUP_META)[] = [
    'foundations',
    'url',
    'pivot',
    'chat',
    'synthesis',
  ];

  return (
    <nav className="text-sm">
      {order.map((group, groupIdx) => {
        const nodes = grouped[group];
        if (!nodes || nodes.length === 0) return null;
        const meta = GROUP_META[group];
        return (
          <div
            key={group}
            className={clsx(
              'space-y-2',
              groupIdx > 0 && 'mt-5 border-t border-border-token pt-5',
            )}
          >
            <Eyebrow className={meta.accentClass}>{meta.eyebrow}</Eyebrow>
            <ul className="space-y-0.5">
              {nodes.map((n) => {
                const active = activeId === n.id;
                return (
                  <li key={n.id}>
                    <a
                      href={`#node-${n.id}`}
                      className={clsx(
                        'group relative flex items-baseline rounded-input pl-3 pr-2 py-1 leading-snug transition-colors',
                        active
                          ? 'bg-bg-subtle text-fg font-medium'
                          : 'text-fg-mute hover:text-fg',
                      )}
                    >
                      <span
                        aria-hidden
                        className={clsx(
                          'absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full transition-opacity',
                          meta.stripeClass,
                          active ? 'opacity-100' : 'opacity-30 group-hover:opacity-70',
                        )}
                      />
                      {typeof n.beat === 'number' && (
                        <span className="mr-2 font-mono text-[10px] text-fg-faint">
                          #{n.beat}
                        </span>
                      )}
                      <span>{n.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function PassSwitcher({
  pass,
  onChange,
}: {
  pass: Pass;
  onChange: (p: Pass) => void;
}) {
  const passes: Pass[] = ['overview', 'deep', 'mastery'];
  return (
    <div className="sticky top-14 z-20 -mx-2 bg-bg/85 px-2 pb-3 pt-3 backdrop-blur">
      <div className="inline-flex items-stretch rounded-card border border-border-token bg-surface p-1">
        {passes.map((p) => {
          const meta = PASS_LABELS[p];
          const active = pass === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={clsx(
                'group relative rounded-[8px] px-4 py-2 text-left transition-colors',
                active ? 'bg-fg text-bg' : 'text-fg-mute hover:text-fg',
              )}
            >
              <span className="block font-sans text-sm font-semibold leading-none">
                {meta.label}
              </span>
              <span
                className={clsx(
                  'mt-1 block font-mono text-[10px] uppercase tracking-eyebrow',
                  active ? 'text-bg/70' : 'text-fg-faint',
                )}
              >
                {meta.sublabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NodeSection({ node, pass }: { node: LessonNode; pass: Pass }) {
  const meta = GROUP_META[node.group];
  return (
    <section
      id={`node-${node.id}`}
      className="relative scroll-mt-32 pl-6 pt-10 first:pt-0"
    >
      <span
        aria-hidden
        className={clsx(
          'absolute left-0 top-10 bottom-0 w-[3px] rounded-full first:top-0',
          meta.stripeClass,
        )}
      />
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow className={meta.accentClass}>{meta.eyebrow}</Eyebrow>
          {typeof node.beat === 'number' && (
            <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
              · beat #{node.beat}
            </span>
          )}
          {node.teachFromZero === true && (
            <span className="font-mono text-[10px] uppercase tracking-eyebrow text-warn">
              · teach from zero
            </span>
          )}
        </div>
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-fg lg:text-4xl">
          {node.label}
        </h2>
        <p className="max-w-2xl font-sans text-[17px] leading-relaxed text-fg-soft">
          {node.oneLine}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={pass}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8"
        >
          {pass === 'overview' && <OverviewPass node={node} />}
          {pass === 'deep' && <DeepPass node={node} />}
          {pass === 'mastery' && <MasteryPass node={node} />}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function OverviewPass({ node }: { node: LessonNode }) {
  return (
    <div className="max-w-[640px] space-y-5">
      <p className="font-sans text-[17px] leading-[1.75] text-fg-soft">
        {node.pass1}
      </p>
      <AskerBadgeRow node={node} />
    </div>
  );
}

function DeepPass({ node }: { node: LessonNode }) {
  const paragraphs = node.pass2.split(/\n\n+/);
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 max-w-[640px] space-y-5">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className="font-sans text-[17px] leading-[1.75] text-fg-soft"
            dangerouslySetInnerHTML={renderInline(p)}
          />
        ))}
      </div>
      <aside className="space-y-5">
        <AnchorCard node={node} />
        <AskerCard node={node} />
      </aside>
    </div>
  );
}

function MasteryPass({ node }: { node: LessonNode }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-4">
        {node.pass3.map((p, i) => (
          <article
            key={i}
            className="rounded-card border border-border-token bg-surface p-5"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-warn-soft text-warn">
                <AlertTriangle className="h-3 w-3" strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="font-sans text-sm font-semibold text-fg">
                  {p.gotcha}
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-fg-soft">
                  {p.note}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
      <aside className="space-y-5">
        <GotchaCard node={node} />
        <FollowupCard node={node} />
      </aside>
    </div>
  );
}

function AnchorCard({ node }: { node: LessonNode }) {
  return (
    <div className="rounded-card border border-border-token bg-surface p-5">
      <Eyebrow className="mb-2">Pergunta-âncora</Eyebrow>
      <p className="font-serif text-lg leading-snug text-fg">"{node.anchor}"</p>
    </div>
  );
}

function AskerCard({ node }: { node: LessonNode }) {
  return (
    <div className="rounded-card border border-border-token bg-surface p-5">
      <Eyebrow className="mb-3">Pra quem perguntar</Eyebrow>
      <ul className="space-y-3">
        {node.askWho.map((a, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-fg-soft">
              <Users className="h-3 w-3" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-sans text-sm font-semibold text-fg">
                {a.name === 'open' ? 'Pergunta aberta ao grupo' : a.name}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-fg-mute">{a.why}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GotchaCard({ node }: { node: LessonNode }) {
  return (
    <div className="rounded-card border border-warn/30 bg-warn-soft/40 p-5">
      <Eyebrow className="mb-2 text-warn">Gotcha da sala</Eyebrow>
      <p className="text-sm leading-relaxed text-fg">{node.gotcha}</p>
    </div>
  );
}

function FollowupCard({ node }: { node: LessonNode }) {
  return (
    <div className="rounded-card border border-border-token bg-surface p-5">
      <Eyebrow className="mb-2">Pergunta-ponte</Eyebrow>
      <div className="flex items-start gap-2">
        <ArrowRight
          className="mt-1 h-4 w-4 shrink-0 text-fg-faint"
          strokeWidth={1.8}
        />
        <p className="text-sm leading-relaxed text-fg">{node.followup}</p>
      </div>
    </div>
  );
}

function AskerBadgeRow({ node }: { node: LessonNode }) {
  if (node.askWho.length === 0) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
        Ask:
      </span>
      {node.askWho.map((a) => (
        <span
          key={a.name}
          className="inline-flex items-center gap-1 rounded-pill border border-border-token bg-surface px-2.5 py-1 font-sans text-xs text-fg"
        >
          <Users className="h-3 w-3 text-fg-faint" strokeWidth={1.8} />
          {a.name === 'open' ? 'grupo aberto' : a.name}
        </span>
      ))}
    </div>
  );
}

function renderInline(text: string): { __html: string } {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const bold = escaped.replace(
    /\*\*(.+?)\*\*/g,
    '<strong class="font-semibold text-fg">$1</strong>',
  );
  const code = bold.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-bg-subtle px-1 py-0.5 font-mono text-[0.85em] text-fg">$1</code>',
  );
  const bullets = code.replace(/\n• /g, '<br/>• ');
  return { __html: bullets };
}
