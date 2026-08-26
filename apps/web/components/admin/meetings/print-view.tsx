'use client';

import { AlertTriangle, ArrowRight, Users } from 'lucide-react';
import type { Lesson, LessonNode } from './lesson-types';
import { GROUP_META } from './group-meta';
import { Glossarized } from './glossarized';

type Pass = 'overview' | 'deep' | 'mastery';

const PASS_META: Record<Pass, { label: string; subtitle: string }> = {
  overview: {
    label: 'Overview',
    subtitle: 'Nomeia tudo. Sai dele com o vocabulário e a árvore mental.',
  },
  deep: {
    label: 'Deep dive',
    subtitle: 'Cada nó explicado. Sai dele pronto pra ensinar.',
  },
  mastery: {
    label: 'Mastery',
    subtitle: 'Pegadinhas e gotchas. Sai dele preparado pra facilitar.',
  },
};

export function PrintView({ lesson }: { lesson: Lesson }) {
  return (
    <div className="print-document hidden print:block">
      <CoverPage lesson={lesson} />
      <PrintChapter lesson={lesson} pass="overview" />
      <PrintChapter lesson={lesson} pass="deep" />
      <PrintChapter lesson={lesson} pass="mastery" />
      <GlossaryChapter lesson={lesson} />
    </div>
  );
}

/**
 * O glossário da aula no PDF de material. É o artefato que o aluno leva pra
 * revisar antes de entrevista, então cada definição cabe numa linha falada.
 * Só renderiza quando a aula declara `glossary`.
 */
function GlossaryChapter({ lesson }: { lesson: Lesson }) {
  const groups = lesson.glossary ?? [];
  if (groups.length === 0) return null;
  const total = groups.reduce((n, g) => n + g.terms.length, 0);
  return (
    <section className="print-chapter">
      <header className="print-chapter-cover">
        <p className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
          Glossário · {total} termos
        </p>
        <h2 className="mt-3 font-serif text-4xl font-semibold leading-tight tracking-tight text-fg">
          O vocabulário da aula
        </h2>
        <p className="mt-3 max-w-[52ch] text-[13px] leading-relaxed text-fg-soft">
          Uma definição por termo, escrita pra ser dita em voz alta numa entrevista.
        </p>
      </header>
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.title} className="print-node break-inside-avoid">
            <p className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
              {group.title}
            </p>
            <dl className="mt-3 space-y-2">
              {group.terms.map((t) => (
                <div key={t.term} className="flex gap-3 break-inside-avoid">
                  <dt className="w-[150px] shrink-0 font-mono text-[11px] font-semibold text-fg">
                    {t.term}
                  </dt>
                  <dd className="flex-1 text-[12px] leading-relaxed text-fg-soft">
                    {t.definition}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

function CoverPage({ lesson }: { lesson: Lesson }) {
  const beats = lesson.nodes.filter((n) => typeof n.beat === 'number').length;
  return (
    <section className="print-cover">
      <p className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
        Aula · System Design
      </p>
      <h1 className="mt-4 font-serif text-5xl font-semibold leading-[1.05] tracking-tight text-fg">
        {lesson.title}
      </h1>
      <p className="mt-3 font-sans text-lg leading-snug text-fg-soft">
        {lesson.subtitle}
      </p>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-eyebrow text-fg-mute">
        {lesson.audience} · {lesson.durationMin} min · {beats} beats
      </p>
      <p className="mt-12 max-w-prose font-sans text-[14px] leading-relaxed text-fg-soft">
        {lesson.blurb}
      </p>
      <div className="mt-12 border-t border-border-token pt-6">
        <p className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
          Esse documento tem 3 passes — Overview, Deep dive e Mastery — cada um
          contém todos os tópicos. Leia em sequência: primeiro o overview pra
          fixar o vocabulário, depois o deep dive pra entender a fundo, e o
          mastery pra mapear as armadilhas comuns.
        </p>
      </div>
    </section>
  );
}

function PrintChapter({ lesson, pass }: { lesson: Lesson; pass: Pass }) {
  const meta = PASS_META[pass];
  const seen = new Set<string>();
  return (
    <section className="print-chapter">
      <header className="print-chapter-cover">
        <p className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
          Pass {pass === 'overview' ? '1' : pass === 'deep' ? '2' : '3'}
        </p>
        <h2 className="mt-2 font-serif text-4xl font-semibold leading-tight tracking-tight text-fg">
          {meta.label}
        </h2>
        <p className="mt-3 font-sans text-base leading-relaxed text-fg-soft">
          {meta.subtitle}
        </p>
      </header>
      <div className="space-y-10">
        {lesson.nodes.map((node) => (
          <PrintNodeBlock key={node.id} node={node} pass={pass} seen={seen} />
        ))}
      </div>
    </section>
  );
}

function PrintNodeBlock({
  node,
  pass,
  seen,
}: {
  node: LessonNode;
  pass: Pass;
  seen: Set<string>;
}) {
  const meta = GROUP_META[node.group];
  return (
    <article className="print-node relative pl-5">
      <span
        aria-hidden
        className={`absolute left-0 top-0 h-full w-[3px] rounded-full ${meta.stripeClass}`}
      />
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
          <span className={meta.accentClass}>{meta.eyebrow}</span>
          {typeof node.beat === 'number' && (
            <span className="ml-2 text-fg-mute">· beat #{node.beat}</span>
          )}
          {node.teachFromZero === true && (
            <span className="ml-2 text-warn">· teach from zero</span>
          )}
        </p>
        <h3 className="font-serif text-2xl font-semibold leading-tight tracking-tight text-fg">
          {node.label}
        </h3>
        <p className="font-sans text-[14px] leading-relaxed text-fg-soft">
          <Glossarized text={node.oneLine} seen={seen} keyPrefix={`${pass}-${node.id}-one`} />
        </p>
      </header>

      {pass === 'overview' && <PrintOverview node={node} seen={seen} />}
      {pass === 'deep' && <PrintDeep node={node} seen={seen} />}
      {pass === 'mastery' && <PrintMastery node={node} seen={seen} />}
    </article>
  );
}

function PrintOverview({
  node,
  seen,
}: {
  node: LessonNode;
  seen: Set<string>;
}) {
  return (
    <div className="mt-4 space-y-4">
      <p className="font-sans text-[14px] leading-[1.65] text-fg">
        <Glossarized text={node.pass1} seen={seen} keyPrefix={`ov-${node.id}-p1`} />
      </p>
      {node.askWho && node.askWho.length > 0 && (
        <div className="rounded-input border border-border-token bg-bg-subtle/50 p-3">
          <p className="font-mono text-[9px] uppercase tracking-eyebrow text-fg-mute font-semibold">
            Pra quem perguntar
          </p>
          <ul className="mt-2 space-y-1.5">
            {node.askWho.map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <Users className="mt-0.5 h-3 w-3 shrink-0 text-fg-faint" strokeWidth={1.8} />
                <span className="text-[12px] leading-relaxed text-fg-soft">
                  <span className="font-semibold text-fg">
                    {a.name === 'open' ? 'Pergunta aberta ao grupo' : a.name}
                  </span>{' '}
                  ·{' '}
                  <Glossarized
                    text={a.why}
                    seen={seen}
                    keyPrefix={`ov-${node.id}-ask-${i}`}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PrintDeep({ node, seen }: { node: LessonNode; seen: Set<string> }) {
  const paragraphs = node.pass2.split(/\n\n+/);
  return (
    <div className="mt-4 space-y-4">
      {paragraphs.map((p, i) => (
        <p
          key={i}
          className="font-sans text-[14px] leading-[1.7] text-fg"
        >
          <Glossarized text={p} seen={seen} keyPrefix={`dp-${node.id}-p2-${i}`} />
        </p>
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-input border border-border-token bg-bg-subtle/40 p-3">
          <p className="font-mono text-[9px] uppercase tracking-eyebrow text-fg-mute font-semibold">
            Pergunta-âncora
          </p>
          <p className="mt-2 font-serif text-[15px] leading-snug text-fg">
            "<Glossarized text={node.anchor} seen={seen} keyPrefix={`dp-${node.id}-anc`} />"
          </p>
        </div>
        {node.askWho && node.askWho.length > 0 && (
        <div className="rounded-input border border-border-token bg-bg-subtle/40 p-3">
          <p className="font-mono text-[9px] uppercase tracking-eyebrow text-fg-mute font-semibold">
            Pra quem perguntar
          </p>
          <ul className="mt-2 space-y-1.5">
            {node.askWho.map((a, i) => (
              <li key={i} className="text-[12px] leading-relaxed text-fg-soft">
                <span className="font-semibold text-fg">
                  {a.name === 'open' ? 'Aberta ao grupo' : a.name}
                </span>{' '}
                ·{' '}
                <Glossarized
                  text={a.why}
                  seen={seen}
                  keyPrefix={`dp-${node.id}-ask-${i}`}
                />
              </li>
            ))}
          </ul>
        </div>
        )}
      </div>
    </div>
  );
}

function PrintMastery({
  node,
  seen,
}: {
  node: LessonNode;
  seen: Set<string>;
}) {
  return (
    <div className="mt-4 space-y-4">
      {node.pass3.length > 0 && (
        <ul className="space-y-3">
          {node.pass3.map((p, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-input border border-border-token bg-surface p-3"
            >
              <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn">
                <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[13px] font-semibold leading-snug text-fg">
                  <Glossarized
                    text={p.gotcha}
                    seen={seen}
                    keyPrefix={`ms-${node.id}-p3-${i}-g`}
                  />
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-fg-soft">
                  <Glossarized
                    text={p.note}
                    seen={seen}
                    keyPrefix={`ms-${node.id}-p3-${i}-n`}
                  />
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-input border border-warn/30 bg-warn-soft/40 p-3">
          <p className="font-mono text-[9px] uppercase tracking-eyebrow text-warn font-semibold">
            Provocação
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-fg">
            <Glossarized text={node.gotcha} seen={seen} keyPrefix={`ms-${node.id}-got`} />
          </p>
        </div>
        <div className="rounded-input border border-border-token bg-bg-subtle/50 p-3">
          <p className="font-mono text-[9px] uppercase tracking-eyebrow text-fg-mute font-semibold">
            Pergunta-ponte
          </p>
          <p className="mt-2 flex items-start gap-2 text-[12px] leading-relaxed text-fg">
            <ArrowRight
              className="mt-0.5 h-3 w-3 shrink-0 text-fg-faint"
              strokeWidth={1.8}
            />
            <span>
              <Glossarized
                text={node.followup}
                seen={seen}
                keyPrefix={`ms-${node.id}-fol`}
              />
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

