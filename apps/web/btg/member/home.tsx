'use client';

import Link from 'next/link';
import { isPositiveOutcome } from '@ics-select/shared';
import { useMeHome, type HomeResponse } from '../../lib/queries/me-home';
import { useMeCohort } from '../../lib/queries/me-cohort';
import { useAuth } from '../../lib/auth/auth-context';
import { HeroMark, Icon, Loading, minutesLabel, platformOf, timeRange } from '../ui';
import { ItemList } from './rows';
import { BTG_MEMBER_BASE } from './shell';

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function Hero({ hero }: { hero: HomeResponse['hero'] }) {
  if (!hero || !('item' in hero)) {
    const allDone = hero?.state === 'all_done';
    return (
      <section className="btg-card btg-card--pad">
        <span className="btg-eyebrow" style={{ color: allDone ? 'var(--btg-done-easy)' : undefined }}>
          {allDone ? 'Tudo feito por hoje' : 'Dia livre'}
        </span>
        <span style={{ fontSize: 24, lineHeight: '32px' }}>
          {allDone ? 'Você fechou o dia. Excelência é constância.' : 'Nenhum estudo agendado para hoje.'}
        </span>
        {hero?.nextAt && (
          <span className="btg-soft">
            Próximo bloco:{' '}
            {new Date(hero.nextAt).toLocaleString('pt-BR', {
              weekday: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </section>
    );
  }

  const { item } = hero;
  const platform = platformOf(item.url, item.format);
  const late = hero.state === 'running_late';
  const eyebrow =
    hero.state === 'now' ? 'Agora' : hero.state === 'up_next' ? 'A seguir' : 'Atrasado';
  const hint =
    hero.state === 'up_next'
      ? `começa em ${minutesLabel(hero.minutesUntil)}`
      : hero.state === 'running_late'
        ? `${minutesLabel(hero.minutesLate)} de atraso`
        : null;

  return (
    <section
      className="btg-card btg-card--focus"
      style={late ? { borderColor: 'var(--btg-stuck)' } : undefined}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span
          className="btg-eyebrow"
          style={{ color: late ? 'var(--btg-stuck)' : 'var(--btg-primary)', fontWeight: 700 }}
        >
          {eyebrow} · {timeRange(item.scheduledAt, item.scheduledMinutes)}
        </span>
        {hint && <span className="btg-mono btg-mute" style={{ fontSize: 13 }}>{hint}</span>}
      </div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div className="btg-media">
          <Icon name="play_circle" style={{ fontSize: 40 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <span className="btg-mute" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <span className="btg-dot" style={{ background: platform.color }} />
            {platform.label} · {item.estimatedMinutes} min
          </span>
          <span style={{ fontSize: 24, lineHeight: '32px' }}>{item.title}</span>
          {item.topic && <span className="btg-soft" style={{ fontSize: 15 }}>Tópico: {item.topic.label}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href={`${BTG_MEMBER_BASE}/item/${item.id}`} className="btg-btn btg-btn--primary">
          <Icon name="play_arrow" />
          Começar agora
        </Link>
        <Link href={`${BTG_MEMBER_BASE}/agenda`} className="btg-btn btg-btn--outline">
          <Icon name="event_repeat" />
          Remarcar
        </Link>
      </div>
    </section>
  );
}

export function BtgHome() {
  const { user } = useAuth();
  const { data, isLoading, error } = useMeHome();
  const { data: cohort } = useMeCohort();

  if (isLoading) return <Loading />;
  if (error || !data) return <Loading label="Não foi possível carregar sua home." />;

  const firstName = user?.name.split(' ')[0] ?? '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const late = data.late ?? [];
  const todayAll = [...late, ...data.today];
  const todayMinutes = data.today.reduce((s, i) => s + (i.scheduledMinutes ?? i.estimatedMinutes), 0);
  const doneToday = todayAll.filter((i) => isPositiveOutcome(i.outcome)).length;
  const activeId = data.hero && 'item' in data.hero ? data.hero.item.id : null;

  const ranking = cohort?.ranking ?? [];
  const myIndex = ranking.findIndex((r) => r.isMe);
  const me = myIndex >= 0 ? ranking[myIndex] : null;
  // Show the leaders plus the member, like the canvas mini-ranking.
  const miniRank = ranking
    .map((r, i) => ({ ...r, pos: i + 1 }))
    .filter((r, i) => i < 3 || r.isMe)
    .slice(0, 4);

  const today = new Date();
  const dateLabel = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const activeDays = data.streak.last7.filter(Boolean).length;
  const last7 = data.streak.last7.map((active, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (data.streak.last7.length - 1 - i));
    return { active, label: WEEKDAYS[d.getDay()] };
  });

  return (
    <>
      <section className="btg-hero">
        <HeroMark />
        <div className="btg-hero-inner">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="btg-hero-eyebrow">
              {cohort?.cycleName ? `${cohort.cycleName} · ` : ''}
              {dateLabel}
            </span>
            <h1>
              {greeting}, {firstName}.
            </h1>
            <p className="btg-hero-sub">
              {data.today.length === 0
                ? 'Nenhum item agendado para hoje.'
                : `Você tem ${data.today.length} ${data.today.length === 1 ? 'item' : 'itens'} hoje, ${minutesLabel(todayMinutes)} planejados na sua agenda.`}
            </p>
          </div>
          <div className="btg-hero-kpis">
            {me && (
              <div className="btg-hero-kpi">
                <span className="btg-hero-kpi-label"><Icon name="trending_up" />Engajamento</span>
                <span className="btg-mono btg-hero-kpi-value">
                  {Math.round(me.score)}<span className="btg-hero-kpi-unit">/100</span>
                </span>
              </div>
            )}
            <div className="btg-hero-kpi">
              <span className="btg-hero-kpi-label"><Icon name="local_fire_department" />Sequência</span>
              <span className="btg-mono btg-hero-kpi-value">
                {data.streak.current}<span className="btg-hero-kpi-unit"> {data.streak.current === 1 ? 'dia' : 'dias'}</span>
              </span>
            </div>
            {me ? (
              <div className="btg-hero-kpi">
                <span className="btg-hero-kpi-label"><Icon name="leaderboard" />Posição</span>
                <span className="btg-mono btg-hero-kpi-value">
                  {myIndex + 1}º<span className="btg-hero-kpi-unit"> de {ranking.length}</span>
                </span>
              </div>
            ) : (
              <div className="btg-hero-kpi">
                <span className="btg-hero-kpi-label"><Icon name="task_alt" />Hoje</span>
                <span className="btg-mono btg-hero-kpi-value">
                  {doneToday}<span className="btg-hero-kpi-unit">/{todayAll.length}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="btg-main">
        <div className="btg-stack">
          <Hero hero={data.hero} />
          <ItemList
            title="Hoje"
            hint={`${data.today.length} ${data.today.length === 1 ? 'item' : 'itens'} · ${minutesLabel(todayMinutes)}`}
            items={data.today}
            activeId={activeId}
          />
          {late.length > 0 && (
            <section className="btg-card btg-card--pad">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="btg-card-title">
                  <Icon name="history" style={{ color: 'var(--btg-secondary)' }} />
                  Pendentes desta semana
                </span>
                <span className="btg-mute" style={{ fontSize: 13 }}>
                  {late.length} {late.length === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {late.map((i) => (
                  <Link
                    key={i.id}
                    href={`${BTG_MEMBER_BASE}/item/${i.id}`}
                    className="btg-candidate"
                    style={{ flex: '1 1 240px', color: 'inherit', padding: '12px 16px' }}
                  >
                    <span
                      className="btg-dot"
                      style={{ background: i.outcome === 'STUCK' ? 'var(--btg-stuck)' : 'var(--btg-pending)' }}
                    />
                    {i.title}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="btg-stack">
          <section className="btg-card btg-card--pad" style={{ gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="btg-card-title">Últimos 7 dias</span>
              <span className="btg-mono" style={{ fontSize: 14 }}>{activeDays}/7</span>
            </div>
            <div className="btg-track">
              <div style={{ width: `${(activeDays / 7) * 100}%` }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
              {last7.map((d, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: '100%',
                      height: 64,
                      borderRadius: 4,
                      background: d.active ? 'var(--btg-primary)' : 'var(--btg-border-soft)',
                    }}
                  />
                  <span className="btg-mute" style={{ fontSize: 12 }}>{d.label}</span>
                </div>
              ))}
            </div>
          </section>

          {data.topicCoverage.length > 0 && (
            <section className="btg-card btg-card--pad">
              <span className="btg-card-title">Tópicos da fase</span>
              {data.topicCoverage.map((t) => {
                const pct = t.itemsPlanned > 0 ? Math.round((t.itemsDone / t.itemsPlanned) * 100) : 0;
                return (
                  <div key={t.topicId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span>{t.label}</span>
                      <span className="btg-mono btg-mute">{pct}%</span>
                    </div>
                    <div className="btg-track btg-track--thin">
                      <div style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {miniRank.length > 0 && (
            <section className="btg-card btg-card--pad" style={{ gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="btg-card-title">Ranking da turma</span>
                <Link href={`${BTG_MEMBER_BASE}/turma`} style={{ fontSize: 14, fontWeight: 600 }}>
                  Ver tudo
                </Link>
              </div>
              {miniRank.map((r) => (
                <div key={r.userId} className={r.isMe ? 'btg-mini-rank btg-mini-rank--me' : 'btg-mini-rank'}>
                  <span className="btg-mono btg-mute" style={{ fontSize: 13, width: 20 }}>{r.pos}</span>
                  <span style={{ flexGrow: 1 }}>{r.isMe ? 'Você' : r.name}</span>
                  <span className="btg-mono">{Math.round(r.score)}</span>
                </div>
              ))}
            </section>
          )}
        </aside>
      </main>
    </>
  );
}
