'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Lesson } from '../../components/admin/meetings/lesson-types';
import { glossaryToWhatsApp } from '../../components/admin/meetings/glossary-panel';
import { HeroMark, Icon } from '../ui';
import { BTG_ADMIN_BASE } from './shell';
import { LiveMode, StudyMode } from './lesson-modes';
import { LessonPrint } from './lesson-print';

type Tab = 'study' | 'live' | 'glossary';

export function BtgLesson({ lesson }: { lesson: Lesson }) {
  const [tab, setTab] = useState<Tab>('study');
  const beats = lesson.nodes.filter((n) => typeof n.beat === 'number').length;
  const glossaryCount = lesson.glossary?.reduce((n, g) => n + g.terms.length, 0) ?? 0;

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'study', label: 'Estudo', icon: 'menu_book' },
    { key: 'live', label: 'Ao vivo', icon: 'sensors' },
    ...(glossaryCount > 0 ? [{ key: 'glossary' as const, label: `Glossário · ${glossaryCount}`, icon: 'list_alt' }] : []),
  ];

  return (
    <>
      <div className="btg-mt-screen">
        <section className="btg-hero btg-hero--800">
          <HeroMark />
          <div className="btg-hero-inner btg-mt-hero">
            <div className="btg-mt-hero-text">
              <Link href={`${BTG_ADMIN_BASE}/aulas`} className="btg-mt-back">
                <Icon name="arrow_back" /> Todas as aulas
              </Link>
              <span className="btg-hero-eyebrow">Aula · System Design</span>
              <h1>{lesson.title}</h1>
              <p className="btg-hero-sub">{lesson.subtitle}</p>
              <p className="btg-mt-hero-meta btg-mono">
                {lesson.audience} · {lesson.durationMin} min · {beats} beats
              </p>
            </div>
            <div className="btg-mt-actions">
              {lesson.slidesUrl && (
                <>
                  <a href={lesson.slidesUrl} target="_blank" rel="noopener noreferrer" className="btg-btn btg-btn--outline btg-btn--sm">
                    <Icon name="slideshow" /> Apresentar
                  </a>
                  <a href={`${lesson.slidesUrl}?print=1`} target="_blank" rel="noopener noreferrer" className="btg-btn btg-btn--outline btg-btn--sm" title="Cada slide vira uma página, salva pelo print do navegador">
                    <Icon name="picture_as_pdf" /> Slides em PDF
                  </a>
                </>
              )}
              <button type="button" className="btg-btn btg-btn--primary btg-btn--sm" onClick={() => window.print()} title="Os 3 passes de cada beat pra estudo offline">
                <Icon name="print" /> Material em PDF
              </button>
            </div>
          </div>
        </section>

        <div className="btg-mt-tabbar">
          <div className="btg-tabs" role="tablist" aria-label="Modo da aula">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
                <Icon name={t.icon} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="btg-mt-body">
          {tab === 'study' && <StudyMode lesson={lesson} />}
          {tab === 'live' && <LiveMode lesson={lesson} />}
          {tab === 'glossary' && <Glossary lesson={lesson} />}
        </div>
      </div>

      <LessonPrint lesson={lesson} />
    </>
  );
}

function Glossary({ lesson }: { lesson: Lesson }) {
  const [copied, setCopied] = useState(false);
  const groups = lesson.glossary ?? [];

  async function copy() {
    await navigator.clipboard.writeText(glossaryToWhatsApp(lesson));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="btg-card">
      <div className="btg-card-head">
        <div>
          <p className="btg-card-title">Glossário da aula</p>
          <p className="btg-mute btg-mt-small">
            Para mandar no grupo depois da aula. O botão copia já formatado para o WhatsApp, com negrito nos termos.
          </p>
        </div>
        <button type="button" className={`btg-btn btg-btn--sm ${copied ? 'btg-btn--primary' : 'btg-btn--outline'}`} onClick={() => void copy()}>
          <Icon name={copied ? 'check' : 'content_copy'} /> {copied ? 'Copiado' : 'Copiar para WhatsApp'}
        </button>
      </div>
      <div className="btg-mt-gloss">
        {groups.map((g, i) => (
          <div key={g.title}>
            <h3>
              <span className="btg-mono btg-mute">{String(i + 1).padStart(2, '0')}</span> {g.title}
            </h3>
            <ul>
              {g.terms.map((t) => (
                <li key={t.term}>
                  <strong>{t.term}</strong> <span className="btg-mute">·</span> {t.definition}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
