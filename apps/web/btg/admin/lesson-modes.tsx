'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Lesson, LessonNode, NodeGroup, Scenario } from '../../components/admin/meetings/lesson-types';
import { GROUP_META } from '../../components/admin/meetings/group-meta';
import { findFirstGlossaryMatch } from '../../components/admin/meetings/glossary';
import { Icon } from '../ui';

// ---------- Shared bits ----------

// GROUP_META carries classic Tailwind classes; we only borrow the tone name
// ("text-primary" → "primary") and map it to a BTG color in admin-meetings.css.
export const toneClass = (g: NodeGroup) => `btg-mt-tone-${GROUP_META[g].accentClass.replace('text-', '')}`;
export const groupLabel = (g: NodeGroup) => GROUP_META[g].eyebrow;
export const askerName = (name: string, open = 'Pergunta aberta ao grupo') => (name === 'open' ? open : name);

export type Pass = 'overview' | 'deep' | 'mastery';
export const PASSES: Record<Pass, { label: string; sub: string; lead: string }> = {
  overview: { label: 'Visão geral', sub: '~30 min · nomeia tudo', lead: 'Nomeia tudo. Sai dele com o vocabulário e a árvore mental.' },
  deep: { label: 'Aprofundamento', sub: '~2 h · prepara pra ensinar', lead: 'Cada nó explicado. Sai dele pronto pra ensinar.' },
  mastery: { label: 'Domínio', sub: '~1 h · pegadinhas', lead: 'Pegadinhas e gotchas. Sai dele preparado pra facilitar.' },
};

function GlossChip({ term, def }: { term: string; def: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <span ref={ref} className="btg-mt-chip">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {term}
      </button>
      {open && (
        <span role="tooltip" className="btg-mt-tip">
          <span className="btg-eyebrow">Glossário · {term}</span>
          <span>{def}</span>
        </span>
      )}
    </span>
  );
}

function gloss(text: string, seen: Set<string>, key: () => number): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  for (let m = findFirstGlossaryMatch(rest, seen); m; m = findFirstGlossaryMatch(rest, seen)) {
    if (m.index > 0) out.push(rest.slice(0, m.index));
    seen.add(m.canonical);
    out.push(<GlossChip key={key()} term={rest.slice(m.index, m.index + m.length)} def={m.def} />);
    rest = rest.slice(m.index + m.length);
  }
  if (rest) out.push(rest);
  return out;
}

const MARKUP = /\*\*([^*]+)\*\*|`([^`]+)`/g;

/** Lesson prose: **bold**, `code` and a glossary popover on each term's first use per render. */
export function Prose({ text, seen }: { text: string; seen: Set<string> }) {
  let k = 0;
  const key = () => k++;
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MARKUP)) {
    if (m.index > last) out.push(...gloss(text.slice(last, m.index), seen, key));
    out.push(
      m[1] !== undefined ? (
        <strong key={key()}>{gloss(m[1], seen, key)}</strong>
      ) : (
        <code key={key()} className="btg-mt-code">
          {m[2]}
        </code>
      ),
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...gloss(text.slice(last), seen, key));
  return <>{out}</>;
}

function NodeEyebrow({ node }: { node: LessonNode }) {
  return (
    <p className="btg-mt-eyebrow">
      <span className="btg-mt-tone-text">{groupLabel(node.group)}</span>
      {typeof node.beat === 'number' && <span> · beat #{node.beat}</span>}
      {node.teachFromZero === true && <span className="btg-mt-warn-text"> · ensinar do zero</span>}
    </p>
  );
}

function Tags({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <div className="btg-mt-tags">
      {tags.map((t) => (
        <span key={t} className="btg-pill btg-pill--neutral btg-mono">
          {t}
        </span>
      ))}
    </div>
  );
}

function Diagram({ node }: { node: LessonNode }) {
  if (node.diagramUrl)
    return (
      <figure className="btg-card btg-mt-figure">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={node.diagramUrl} alt={`Diagrama: ${node.label}`} className="btg-mt-diagram-img" />
      </figure>
    );
  if (node.diagram)
    return (
      <figure className="btg-card btg-mt-figure">
        <figcaption className="btg-mt-figcap">
          <Icon name="account_tree" /> Diagrama · Mermaid
        </figcaption>
        <pre className="btg-mt-pre btg-mono">{node.diagram}</pre>
      </figure>
    );
  return null;
}

function Callout({ label, icon, tone, children }: { label: string; icon?: string; tone?: 'warn'; children: ReactNode }) {
  return (
    <div className={`btg-mt-callout${tone ? ` btg-mt-callout--${tone}` : ''}`}>
      <p className="btg-mt-eyebrow">
        {icon && <Icon name={icon} />}
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

function Askers({ node, seen }: { node: LessonNode; seen: Set<string> }) {
  const top = (node.askWho ?? []).slice(0, 3);
  if (!top.length) return null;
  return (
    <ol className="btg-mt-askers">
      {top.map((a, i) => (
        <li key={i}>
          <span className="btg-mt-num btg-mono">{i + 1}</span>
          <div>
            <strong>{askerName(a.name)}</strong>
            <p className="btg-mute">
              <Prose text={a.why} seen={seen} />
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Pegadinhas({ items, seen, limit }: { items: LessonNode['pass3']; seen: Set<string>; limit?: number }) {
  if (!items.length) return null;
  return (
    <ul className="btg-mt-gotchas">
      {items.slice(0, limit).map((p, i) => (
        <li key={i}>
          <span className="btg-mt-gotcha-icon">
            <Icon name="warning" />
          </span>
          <div>
            <strong>
              <Prose text={p.gotcha} seen={seen} />
            </strong>
            <p className="btg-soft">
              <Prose text={p.note} seen={seen} />
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- Study mode ----------

export function StudyMode({ lesson }: { lesson: Lesson }) {
  const [activeId, setActiveId] = useState(lesson.nodes[0]?.id ?? '');
  const [pass, setPass] = useState<Pass>('overview');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id.replace(/^node-/, ''));
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 },
    );
    lesson.nodes.forEach((n) => {
      const el = document.getElementById(`node-${n.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [lesson]);

  const groups: NodeGroup[] = [...new Set(lesson.nodes.map((n) => n.group))];
  const seen = new Set<string>();

  return (
    <div className="btg-mt-study">
      <aside className="btg-card btg-mt-toc">
        <nav aria-label="Sumário da aula">
          {groups.map((g) => (
            <div key={g} className={`btg-mt-toc-group ${toneClass(g)}`}>
              <p className="btg-mt-eyebrow btg-mt-tone-text">{groupLabel(g)}</p>
              {lesson.nodes
                .filter((n) => n.group === g)
                .map((n) => (
                  <a key={n.id} href={`#node-${n.id}`} aria-current={activeId === n.id ? 'location' : undefined}>
                    {typeof n.beat === 'number' && <span className="btg-mono">#{n.beat}</span>}
                    <span>{n.label}</span>
                  </a>
                ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="btg-mt-study-main">
        <div className="btg-mt-passbar">
          <div className="btg-mt-seg" role="tablist" aria-label="Passe de estudo">
            {(Object.keys(PASSES) as Pass[]).map((p) => (
              <button key={p} type="button" role="tab" aria-selected={pass === p} onClick={() => setPass(p)}>
                <strong>{PASSES[p].label}</strong>
                <span>{PASSES[p].sub}</span>
              </button>
            ))}
          </div>
        </div>

        {lesson.nodes.map((node) => (
          <section key={node.id} id={`node-${node.id}`} className={`btg-card btg-mt-node ${toneClass(node.group)}`}>
            <header className="btg-mt-node-head">
              <NodeEyebrow node={node} />
              <h2>{node.label}</h2>
              <p className="btg-mt-lead btg-soft">
                <Prose text={node.oneLine} seen={seen} />
              </p>
              <Tags tags={node.tags} />
            </header>
            <div key={pass} className="btg-mt-fade">
              {pass === 'overview' && <OverviewPass node={node} seen={seen} />}
              {pass === 'deep' && <DeepPass node={node} seen={seen} />}
              {pass === 'mastery' && <MasteryPass node={node} seen={seen} />}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function OverviewPass({ node, seen }: { node: LessonNode; seen: Set<string> }) {
  const names = (node.askWho ?? [])
    .slice(0, 3)
    .map((a) => (a.name === 'open' ? 'grupo' : a.name.split(' ')[0]))
    .join(', ');
  return (
    <div className="btg-mt-prose">
      <p>
        <Prose text={node.pass1} seen={seen} />
      </p>
      <Diagram node={node} />
      {names && (
        <p className="btg-mt-askrow btg-mute">
          <Icon name="group" /> Perguntar para: {names}
        </p>
      )}
    </div>
  );
}

function DeepPass({ node, seen }: { node: LessonNode; seen: Set<string> }) {
  return (
    <>
      <div className="btg-mt-split">
        <div className="btg-mt-prose">
          {node.pass2.split(/\n\n+/).map((p, i) => (
            <p key={i}>
              <Prose text={p} seen={seen} />
            </p>
          ))}
        </div>
        <aside className="btg-mt-side">
          <Callout label="Pergunta-âncora" icon="anchor">
            <p className="btg-mt-quote">
              “<Prose text={node.anchor} seen={seen} />”
            </p>
          </Callout>
          {!!node.askWho?.length && (
            <Callout label="Top 3 pra perguntar" icon="record_voice_over">
              <Askers node={node} seen={seen} />
            </Callout>
          )}
        </aside>
      </div>
      {node.visuals?.map((v, i) => (
        <figure key={i} className="btg-card btg-mt-figure">
          <figcaption className="btg-mt-figcap">
            <Icon name="draw" /> {v.title}
          </figcaption>
          {v.kind === 'ascii' ? (
            <pre className="btg-mt-pre btg-mono">{v.art}</pre>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.src} alt={v.alt} className="btg-mt-visual-img" />
          )}
          {(v.caption || v.board || v.kind === 'image') && (
            <div className="btg-mt-figfoot">
              {v.caption && <p className="btg-soft">{v.caption}</p>}
              {v.board && (
                <p className="btg-soft">
                  <span className="btg-eyebrow">No quadro</span> {v.board}
                </p>
              )}
              {v.kind === 'image' && (
                <p className="btg-mt-credit">
                  {v.creditUrl ? (
                    <a href={v.creditUrl} target="_blank" rel="noopener noreferrer">
                      {v.credit}
                    </a>
                  ) : (
                    v.credit
                  )}
                </p>
              )}
            </div>
          )}
        </figure>
      ))}
      <Diagram node={node} />
    </>
  );
}

function MasteryPass({ node, seen }: { node: LessonNode; seen: Set<string> }) {
  return (
    <div className="btg-mt-split">
      <Pegadinhas items={node.pass3} seen={seen} />
      <aside className="btg-mt-side">
        <Callout label="Gotcha da sala" icon="error" tone="warn">
          <p>
            <Prose text={node.gotcha} seen={seen} />
          </p>
        </Callout>
        <Callout label="Pergunta-ponte" icon="arrow_forward">
          <p>
            <Prose text={node.followup} seen={seen} />
          </p>
        </Callout>
      </aside>
    </div>
  );
}

// ---------- Live mode ----------

type Beat = LessonNode & { beat: number };

const SCENARIOS: { kind: keyof NonNullable<LessonNode['scenarios']>; label: string; redirect: string; icon: string }[] = [
  { kind: 'right', label: 'Acertou', redirect: 'Como avançar', icon: 'check' },
  { kind: 'close', label: 'Tá quase lá', redirect: 'Como completar', icon: 'pending' },
  { kind: 'wayOff', label: 'Passou longe', redirect: 'Como redirecionar', icon: 'close' },
];

export function LiveMode({ lesson }: { lesson: Lesson }) {
  const beats = useMemo(
    () => lesson.nodes.filter((n): n is Beat => typeof n.beat === 'number').sort((a, b) => a.beat - b.beat),
    [lesson],
  );
  const [index, setIndex] = useState(0);
  const go = useCallback((d: number) => setIndex((i) => Math.max(0, Math.min(beats.length - 1, i + d))), [beats.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /input|textarea/i.test(e.target.tagName)) return;
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

  // Keep the active beat visible in the horizontal stepper.
  useEffect(() => {
    document.getElementById(`beat-step-${index}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [index]);

  const node = beats[index];
  if (!node) return <p className="btg-empty">Esta aula não tem beats para o modo ao vivo.</p>;
  const prev = beats[index - 1];
  const next = beats[index + 1];
  const seen = new Set<string>();

  return (
    <div className="btg-mt-live">
      <ol className="btg-mt-stepper">
        {beats.map((b, i) => (
          <li key={b.id}>
            <button
              id={`beat-step-${i}`}
              type="button"
              className={toneClass(b.group)}
              aria-current={i === index ? 'step' : undefined}
              data-passed={i < index || undefined}
              onClick={() => setIndex(i)}
            >
              <span className="btg-mono">Beat {b.beat}</span>
              <span>{b.label}</span>
            </button>
          </li>
        ))}
      </ol>

      <article key={node.id} className={`btg-card btg-mt-focus btg-mt-fade ${toneClass(node.group)}`}>
        <header className="btg-mt-focus-head">
          <NodeEyebrow node={node} />
          <h2>{node.label}</h2>
          <Tags tags={node.tags} />
        </header>
        <div className="btg-mt-focus-body">
          <div className="btg-mt-focus-col">
            <div>
              <p className="btg-mt-eyebrow">Pergunta-âncora</p>
              <p className="btg-mt-anchor">
                “<Prose text={node.anchor} seen={seen} />”
              </p>
              <p className="btg-soft btg-mt-oneline">
                <Prose text={node.oneLine} seen={seen} />
              </p>
            </div>
            <Diagram node={node} />
            {!!node.askWho?.length && (
              <div>
                <p className="btg-mt-eyebrow">Top 3 pra perguntar</p>
                <Askers node={node} seen={seen} />
              </div>
            )}
            {node.pass3.length > 0 && (
              <div>
                <p className="btg-mt-eyebrow">Pegadinhas (scan de 5s)</p>
                <Pegadinhas items={node.pass3} seen={seen} limit={3} />
              </div>
            )}
          </div>
          <div className="btg-mt-focus-col">
            {node.scenarios && (
              <div>
                <p className="btg-mt-eyebrow">Cenários de resposta</p>
                <div className="btg-mt-scenarios">
                  {SCENARIOS.map((s) => {
                    const sc: Scenario = node.scenarios![s.kind];
                    return (
                      <div key={s.kind} className={`btg-mt-scenario btg-mt-scenario--${s.kind}`}>
                        <p className="btg-mt-scenario-title">
                          <Icon name={s.icon} /> {s.label}
                        </p>
                        <p>
                          <span className="btg-eyebrow">Forma:</span> <Prose text={sc.shape} seen={seen} />
                        </p>
                        <p>
                          <span className="btg-eyebrow">{s.redirect}:</span> <Prose text={sc.redirect} seen={seen} />
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <Callout label="Provocação" icon="error" tone="warn">
              <p>
                <Prose text={node.gotcha} seen={seen} />
              </p>
            </Callout>
            <Callout label="Pergunta-ponte" icon="arrow_forward">
              <p>
                <Prose text={node.followup} seen={seen} />
              </p>
            </Callout>
          </div>
        </div>
      </article>

      <nav className="btg-mt-beatnav" aria-label="Navegar entre beats">
        <button type="button" className="btg-mt-navbtn" disabled={!prev} onClick={() => go(-1)}>
          <Icon name="arrow_back" />
          <span>
            <span className="btg-eyebrow">Anterior</span>
            <span>{prev?.label ?? '—'}</span>
          </span>
        </button>
        <span className="btg-mt-kbd btg-mute">
          <kbd>←</kbd>
          <kbd>→</kbd> navegar
        </span>
        <button type="button" className="btg-mt-navbtn btg-mt-navbtn--next" disabled={!next} onClick={() => go(1)}>
          <span>
            <span className="btg-eyebrow">Próximo</span>
            <span>{next?.label ?? '—'}</span>
          </span>
          <Icon name="arrow_forward" />
        </button>
      </nav>
    </div>
  );
}
