'use client';

import type { Lesson, LessonNode } from '../../components/admin/meetings/lesson-types';
import { PASSES, Prose, askerName, groupLabel, toneClass, type Pass } from './lesson-modes';

// Hidden on screen, shown by @media print: cover + the 3 passes + the lesson glossary.
export function LessonPrint({ lesson }: { lesson: Lesson }) {
  const beats = lesson.nodes.filter((n) => typeof n.beat === 'number').length;
  const glossary = lesson.glossary ?? [];
  return (
    <div className="btg-mt-print">
      <section className="btg-mt-print-cover">
        <p className="btg-eyebrow">Aula · System Design</p>
        <h1>{lesson.title}</h1>
        <p className="btg-mt-print-sub">{lesson.subtitle}</p>
        <p className="btg-eyebrow btg-mono">
          {lesson.audience} · {lesson.durationMin} min · {beats} beats
        </p>
        <p>{lesson.blurb}</p>
        <p className="btg-mt-print-note">
          Este documento tem 3 passes (Visão geral, Aprofundamento e Domínio) e cada um contém todos os tópicos. Leia em
          sequência: a visão geral fixa o vocabulário, o aprofundamento explica a fundo e o domínio mapeia as armadilhas.
        </p>
      </section>

      {(Object.keys(PASSES) as Pass[]).map((pass, i) => {
        const seen = new Set<string>();
        return (
          <section key={pass} className="btg-mt-print-chapter">
            <header className="btg-mt-print-chapter-head">
              <p className="btg-eyebrow">Passe {i + 1}</p>
              <h2>{PASSES[pass].label}</h2>
              <p>{PASSES[pass].lead}</p>
            </header>
            {lesson.nodes.map((node) => (
              <PrintNode key={node.id} node={node} pass={pass} seen={seen} />
            ))}
          </section>
        );
      })}

      {glossary.length > 0 && (
        <section className="btg-mt-print-chapter">
          <header className="btg-mt-print-chapter-head">
            <p className="btg-eyebrow">Glossário · {glossary.reduce((n, g) => n + g.terms.length, 0)} termos</p>
            <h2>O vocabulário da aula</h2>
            <p>Uma definição por termo, escrita pra ser dita em voz alta numa entrevista.</p>
          </header>
          {glossary.map((g) => (
            <div key={g.title} className="btg-mt-print-node">
              <p className="btg-eyebrow">{g.title}</p>
              <dl className="btg-mt-print-dl">
                {g.terms.map((t) => (
                  <div key={t.term}>
                    <dt className="btg-mono">{t.term}</dt>
                    <dd>{t.definition}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function PrintNode({ node, pass, seen }: { node: LessonNode; pass: Pass; seen: Set<string> }) {
  const askers = node.askWho?.length ? (
    <div className="btg-mt-print-box">
      <p className="btg-eyebrow">Pra quem perguntar</p>
      {node.askWho.map((a, i) => (
        <p key={i}>
          <strong>{askerName(a.name)}</strong> · <Prose text={a.why} seen={seen} />
        </p>
      ))}
    </div>
  ) : null;

  return (
    <article className={`btg-mt-print-node btg-mt-print-stripe ${toneClass(node.group)}`}>
      <p className="btg-eyebrow">
        <span className="btg-mt-tone-text">{groupLabel(node.group)}</span>
        {typeof node.beat === 'number' && ` · beat #${node.beat}`}
        {node.teachFromZero === true && ' · ensinar do zero'}
      </p>
      <h3>{node.label}</h3>
      <p className="btg-soft">
        <Prose text={node.oneLine} seen={seen} />
      </p>

      {pass === 'overview' && (
        <>
          <p>
            <Prose text={node.pass1} seen={seen} />
          </p>
          {askers}
        </>
      )}

      {pass === 'deep' && (
        <>
          {node.pass2.split(/\n\n+/).map((p, i) => (
            <p key={i}>
              <Prose text={p} seen={seen} />
            </p>
          ))}
          <div className="btg-mt-print-grid">
            <div className="btg-mt-print-box">
              <p className="btg-eyebrow">Pergunta-âncora</p>
              <p>
                “<Prose text={node.anchor} seen={seen} />”
              </p>
            </div>
            {askers}
          </div>
        </>
      )}

      {pass === 'mastery' && (
        <>
          {node.pass3.map((p, i) => (
            <div key={i} className="btg-mt-print-box">
              <p>
                <strong>
                  <Prose text={p.gotcha} seen={seen} />
                </strong>
              </p>
              <p className="btg-soft">
                <Prose text={p.note} seen={seen} />
              </p>
            </div>
          ))}
          <div className="btg-mt-print-grid">
            <div className="btg-mt-print-box">
              <p className="btg-eyebrow">Provocação</p>
              <p>
                <Prose text={node.gotcha} seen={seen} />
              </p>
            </div>
            <div className="btg-mt-print-box">
              <p className="btg-eyebrow">Pergunta-ponte</p>
              <p>
                <Prose text={node.followup} seen={seen} />
              </p>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
