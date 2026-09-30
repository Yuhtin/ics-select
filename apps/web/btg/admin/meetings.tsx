'use client';

import Link from 'next/link';
import type { MeetingSummary } from '../../components/admin/meetings/lesson-types';
import { Icon } from '../ui';
import { BTG_ADMIN_BASE } from './shell';
import { groupLabel, toneClass } from './lesson-modes';

export function BtgMeetings({ meetings }: { meetings: MeetingSummary[] }) {
  return (
    <>
      <header className="btg-admin-header">
        <div className="btg-admin-header-title">
          <span>Roteiros de facilitação</span>
          <span>Aulas</span>
        </div>
        <span className="btg-pill btg-pill--neutral">
          <span className="btg-mono">{meetings.length}</span>&nbsp;aulas
        </span>
      </header>
      <div className="btg-mt-page">
        <p className="btg-soft btg-mt-intro">
          Cada aula tem o modo Estudo pra você preparar e o modo Ao vivo pra navegar durante o encontro.
        </p>
        {meetings.length === 0 ? (
          <div className="btg-card btg-empty">Sem aulas montadas ainda.</div>
        ) : (
          meetings.map((m) => (
            <article key={m.slug} className={`btg-card btg-mt-meeting ${toneClass(m.primaryGroup)}`}>
              <div className="btg-mt-meeting-text">
                <p className="btg-mt-eyebrow btg-mt-tone-text">System Design · {groupLabel(m.primaryGroup)}</p>
                <h2>
                  <Link href={`${BTG_ADMIN_BASE}/aulas/${m.slug}`} className="btg-mt-stretch">
                    {m.title}
                  </Link>
                </h2>
                <p className="btg-soft">{m.subtitle}</p>
                <p className="btg-mute btg-mt-small">{m.blurb}</p>
                <p className="btg-mt-meta btg-mute">
                  <span>
                    <Icon name="group" /> {m.audience}
                  </span>
                  <span>
                    <Icon name="schedule" /> <span className="btg-mono">{m.durationMin}</span> min
                  </span>
                  <span>
                    <Icon name="layers" /> <span className="btg-mono">{m.beatCount}</span> beats
                  </span>
                </p>
              </div>
              <div className="btg-mt-meeting-actions">
                {m.slidesUrl && (
                  <a href={m.slidesUrl} target="_blank" rel="noopener noreferrer" className="btg-btn btg-btn--outline btg-btn--sm" title="Abrir slides em nova aba">
                    <Icon name="slideshow" /> Apresentar
                  </a>
                )}
                <Icon name="chevron_right" />
              </div>
            </article>
          ))
        )}
      </div>
    </>
  );
}
