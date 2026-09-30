'use client';

import { useMeCohort, type CohortEvent } from '../../lib/queries/me-cohort';
import { Avatar, HeroMark, Loading, relativeFromNow } from '../ui';

const EVENT: Record<CohortEvent['kind'], { verb: string; color: string }> = {
  finished: { verb: 'concluiu', color: 'var(--btg-done-easy)' },
  got_stuck: { verb: 'travou em', color: 'var(--btg-stuck)' },
  had_doubts: { verb: 'marcou dúvidas em', color: 'var(--btg-doubts)' },
  posted_retro: { verb: 'enviou a retro da semana', color: 'var(--btg-primary)' },
  started_week: { verb: 'começou a semana', color: 'var(--btg-secondary)' },
};

export function BtgCohort() {
  const { data, isLoading, error } = useMeCohort();
  if (isLoading) return <Loading />;
  if (error || !data) return <Loading label="Não foi possível carregar a turma." />;

  const ranking = data.ranking;

  return (
    <>
      <section className="btg-hero btg-hero--800">
        <HeroMark />
        <div className="btg-hero-inner" style={{ paddingBlock: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="btg-hero-eyebrow">
              {data.cycleName} · {data.memberCount} membros
            </span>
            <h1 style={{ fontSize: 32, lineHeight: '40px' }}>
              {ranking ? 'Meritocracia à vista: o ranking de engajamento' : 'Sua turma'}
            </h1>
            <p className="btg-hero-sub" style={{ fontSize: 16 }}>
              {ranking
                ? 'Mesma nota que o Diretor Educacional vê. Você enxerga só o total, não o detalhamento dos colegas.'
                : 'O ranking ainda não foi aberto para a turma.'}
            </p>
          </div>
        </div>
      </section>

      <main className="btg-main btg-main--3-2">
        <section className="btg-card">
          <div className="btg-rank-row btg-rank-row--head btg-eyebrow">
            <span>#</span>
            <span>Membro</span>
            {ranking ? <span className="btg-rank-bar">Engajamento</span> : <span />}
            <span style={{ textAlign: 'right' }}>{ranking ? 'Nota' : ''}</span>
          </div>
          {ranking
            ? ranking.map((r, i) => (
                <div key={r.userId} className={r.isMe ? 'btg-rank-row btg-rank-row--me' : 'btg-rank-row'}>
                  <span className="btg-mono btg-mute" style={{ fontSize: 14 }}>{i + 1}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, minWidth: 0 }}>
                    <Avatar name={r.name} pictureUrl={r.pictureUrl} size="sm" />
                    {r.isMe ? 'Você' : r.name}
                  </span>
                  <div className="btg-track btg-rank-bar" style={{ height: 6 }}>
                    <div
                      style={{
                        width: `${Math.max(0, Math.min(100, r.score))}%`,
                        background: r.isMe ? 'var(--btg-primary)' : 'var(--btg-secondary)',
                      }}
                    />
                  </div>
                  <span className="btg-mono" style={{ fontSize: 15, textAlign: 'right' }}>
                    {Math.round(r.score)}
                  </span>
                </div>
              ))
            : [...data.members]
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                .map((m, i) => (
                  <div key={m.userId} className={m.isMe ? 'btg-rank-row btg-rank-row--me' : 'btg-rank-row'}>
                    <span className="btg-mono btg-mute" style={{ fontSize: 14 }}>{i + 1}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15 }}>
                      <Avatar name={m.name} pictureUrl={m.pictureUrl} size="sm" />
                      {m.isMe ? 'Você' : m.name}
                    </span>
                    <span />
                    <span />
                  </div>
                ))}
        </section>

        <aside className="btg-stack">
          <section className="btg-card btg-card--pad">
            <span className="btg-card-title">Atividade da turma</span>
            {data.feed.length === 0 && <span className="btg-mute" style={{ fontSize: 14 }}>Nenhuma atividade ainda.</span>}
            {data.feed.slice(0, 12).map((e) => (
              <div key={e.id} className="btg-feed-item">
                <span className="btg-dot" style={{ background: EVENT[e.kind].color, marginTop: 7 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, lineHeight: '20px' }}>
                    {e.member.name} {EVENT[e.kind].verb}
                    {e.itemTitle ? ` ${e.itemTitle}` : ''}
                  </span>
                  <span className="btg-mono btg-mute" style={{ fontSize: 12 }}>{relativeFromNow(e.at)}</span>
                </div>
              </div>
            ))}
          </section>
        </aside>
      </main>
    </>
  );
}
