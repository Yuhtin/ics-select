'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ApiErrorResponse } from '../../lib/api/client';
import {
  useAdminActiveCycleOverview,
  useAdminCycleOverview,
  type CycleOverviewFeedEvent,
  type CycleOverviewResponse,
} from '../../lib/queries/admin-cycle';
import { useAdminTriage, useDismissAlert, type TriageAlert } from '../../lib/queries/admin-triage';
import { Icon, Loading, relativeFromNow } from '../ui';
import { BTG_ADMIN_BASE } from './shell';
import { BtgCycleMembers, BtgRankingToggle } from './cycles-roster';
import { BtgClassesSection } from './cycles-classes';

// Keys match the breakdown labels from apps/api/.../engagement-score.ts.
const COLUMNS = [
  { key: 'Cohort rank', label: 'Rank' },
  { key: 'Days active', label: 'Dias' },
  { key: 'Plan completion', label: 'Plano' },
  { key: 'Retros submitted', label: 'Retro' },
  { key: 'Class attendance', label: 'Aulas' },
  { key: 'Recency', label: 'Rec.' },
];

const HEAT = ['var(--btg-border-soft)', 'var(--btg-blue-100)', 'var(--btg-blue-300)', 'var(--btg-primary)', 'var(--btg-navy-800)'];
const heat = (v: number) => HEAT[v === 0 ? 0 : v <= 25 ? 1 : v <= 50 ? 2 : v <= 80 ? 3 : 4];

const FEED: Record<CycleOverviewFeedEvent['kind'], { icon: string; color: string; verb: string }> = {
  finished: { icon: 'task_alt', color: 'var(--btg-done-easy)', verb: 'concluiu' },
  got_stuck: { icon: 'block', color: 'var(--btg-stuck)', verb: 'travou em' },
  had_doubts: { icon: 'help', color: 'var(--btg-doubts)', verb: 'marcou dúvidas em' },
  posted_retro: { icon: 'edit_note', color: 'var(--btg-primary)', verb: 'enviou a retro' },
};

const SEVERITY_COLOR = { urgent: 'var(--btg-stuck)', attention: 'var(--btg-done-hard)', scheduled: 'var(--btg-pending)' };

function alertHref(a: TriageAlert): string {
  if (a.type === 'PLAN_PENDING' || a.type === 'FINISHED_EARLY') return `${BTG_ADMIN_BASE}/member/${a.member.id}/plan/new`;
  return `${BTG_ADMIN_BASE}/member/${a.member.id}`;
}

function CycleView({ data }: { data: CycleOverviewResponse }) {
  const triage = useAdminTriage(data.cycle.id);
  const dismiss = useDismissAlert();
  const alerts = (triage.data?.alerts ?? []).filter((a) => a.severity !== 'scheduled');
  const avg =
    data.members.length > 0
      ? Math.round(data.members.reduce((s, m) => s + m.percentThisWeek, 0) / data.members.length)
      : 0;
  const { weekNumber, weeksTotal } = data.cycle;

  const kpis = [
    { icon: 'group', label: 'Membros', value: String(data.members.length) },
    { icon: 'task_alt', label: 'Conclusão média', value: `${avg}%` },
    { icon: 'calendar_month', label: 'Semana', value: weekNumber > 0 ? `${weekNumber}/${weeksTotal}` : 'Em breve' },
    { icon: 'warning', label: 'Alertas', value: triage.isLoading ? '—' : String(alerts.length) },
  ];

  return (
    <>
      <header className="btg-admin-header">
        <div className="btg-admin-header-title">
          <span>Ciclo ativo</span>
          <span>
            {data.cycle.name}
            {weekNumber > 0 ? ` · Semana ${weekNumber} de ${weeksTotal}` : ` · começa em breve`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <BtgRankingToggle cycleId={data.cycle.id} checked={data.cycle.rankingVisibleToMembers} />
          <Link href={`${BTG_ADMIN_BASE}/cycle/${data.cycle.id}/resumo`} className="btg-btn btg-btn--outline btg-btn--sm">
            <Icon name="receipt_long" />
            Resumo do ciclo
          </Link>
          <Link href={`${BTG_ADMIN_BASE}/planos?cycleId=${data.cycle.id}`} className="btg-btn btg-btn--primary btg-btn--sm">
            <Icon name="auto_awesome" />
            Planos da semana
          </Link>
        </div>
      </header>

      <main className="btg-admin-main">
        <div className="btg-stack">
          <BtgCycleMembers data={data} />
          <div className="btg-kpis">
            {kpis.map((k) => (
              <div key={k.label} className="btg-card btg-kpi">
                <span className="btg-kpi-label"><Icon name={k.icon} />{k.label}</span>
                <span className="btg-mono btg-kpi-value">{k.value}</span>
              </div>
            ))}
          </div>

          {data.ranking.length > 0 && (
            <section className="btg-card">
              <div className="btg-card-head" style={{ padding: '16px 20px' }}>
                <span className="btg-card-title">Ranking de engajamento</span>
                <span className="btg-mute" style={{ fontSize: 13 }}>
                  {data.cycle.rankingVisibleToMembers ? 'Visível para membros' : 'Oculto para membros'}
                </span>
              </div>
              <div className="btg-table-row btg-table-row--head">
                <span>#</span>
                <span>Membro</span>
                {COLUMNS.map((c) => (
                  <span key={c.key} className="btg-num">{c.label}</span>
                ))}
                <span className="btg-num btg-total">Total</span>
              </div>
              {data.ranking.map((r, i) => (
                <div key={r.userId} className="btg-table-row btg-mono">
                  <span className="btg-mute">{i + 1}</span>
                  <span style={{ fontFamily: 'var(--btg-font-sans)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Link href={`${BTG_ADMIN_BASE}/member/${r.userId}`} style={{ color: 'inherit' }}>{r.name}</Link>
                    {r.hasAlert && <Icon name="warning" style={{ fontSize: 18, color: 'var(--btg-stuck)' }} />}
                    <Link
                      href={`${BTG_ADMIN_BASE}/member/${r.userId}/plan/new`}
                      aria-label={`Plano da semana de ${r.name}`}
                      title="Plano da semana"
                      style={{ marginLeft: 'auto', display: 'inline-flex' }}
                    >
                      <Icon name="edit_calendar" style={{ fontSize: 18 }} />
                    </Link>
                  </span>
                  {COLUMNS.map((c) => {
                    const entry = r.breakdown.find((b) => b.label === c.key);
                    return (
                      <span key={c.key} className="btg-num" title={entry ? `${entry.value.toFixed(1)} de ${entry.weight}` : undefined}>
                        {entry ? entry.value.toFixed(1) : '—'}
                      </span>
                    );
                  })}
                  <span className="btg-num btg-total" style={{ fontWeight: 600, color: 'var(--btg-secondary)' }}>
                    {Math.round(r.score)}
                  </span>
                </div>
              ))}
            </section>
          )}

          <section className="btg-card">
            <div className="btg-card-head" style={{ padding: '16px 20px', justifyContent: 'flex-start' }}>
              <Icon name="flag" style={{ color: 'var(--btg-stuck)' }} />
              <span className="btg-card-title">Triagem</span>
              <span className="btg-mute" style={{ fontSize: 13, marginLeft: 'auto' }}>
                {alerts.length === 0 ? 'Tudo em dia' : `${alerts.length} ${alerts.length === 1 ? 'alerta' : 'alertas'}`}
              </span>
            </div>
            {alerts.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--btg-border-soft)' }}>
                <span className="btg-dot" style={{ background: SEVERITY_COLOR[a.severity] }} />
                <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 15 }}>{a.member.name}</span>
                  <span className="btg-mute" style={{ fontSize: 13 }}>
                    {a.summary} · {relativeFromNow(a.occurredAt)}
                  </span>
                </div>
                <button
                  type="button"
                  className="btg-icon-btn"
                  aria-label="Dispensar alerta"
                  onClick={() => dismiss.mutate({ alertType: a.type, targetId: a.targetId ?? a.member.id })}
                >
                  <Icon name="close" />
                </button>
                <Link href={alertHref(a)} style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  Abrir
                  <Icon name="chevron_right" style={{ fontSize: 18 }} />
                </Link>
              </div>
            ))}
          </section>

          {data.heatmap.rows.length > 0 && (
            <section className="btg-card btg-card--pad" style={{ gap: 12, padding: '16px 20px' }}>
              <span className="btg-card-title">Mapa de calor da turma · conclusão por semana</span>
              <div style={{ overflowX: 'auto' }}>
                <div
                  className="btg-heat"
                  style={{ gridTemplateColumns: `140px repeat(${data.heatmap.weeks.length}, minmax(28px, 64px))` }}
                >
                  <span />
                  {data.heatmap.weeks.map((w) => (
                    <span key={w.index} className="btg-mono btg-mute" style={{ fontSize: 11, textAlign: 'center' }}>{w.label}</span>
                  ))}
                  {data.heatmap.rows.map((row) => (
                    <HeatRow key={row.userId} name={row.name} cells={row.cells} weeks={data.heatmap.weeks.map((w) => w.label)} />
                  ))}
                </div>
              </div>
              <div className="btg-mute" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                menos
                {HEAT.map((c) => (
                  <span key={c} style={{ width: 16, height: 10, background: c }} />
                ))}
                mais
              </div>
            </section>
          )}

          <BtgClassesSection cycleId={data.cycle.id} members={data.members} />
        </div>

        <aside className="btg-card btg-card--pad" style={{ padding: 20 }}>
          <span className="btg-card-title">Atividade · últimos 7 dias</span>
          {data.feed.length === 0 && <span className="btg-mute" style={{ fontSize: 14 }}>Sem atividade.</span>}
          {data.feed.slice(0, 20).map((e) => (
            <div key={e.id} className="btg-feed-item" style={{ gap: 10 }}>
              <Icon name={FEED[e.kind].icon} style={{ fontSize: 18, color: FEED[e.kind].color }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, lineHeight: '20px' }}>
                  {e.member.name} {FEED[e.kind].verb}
                  {e.itemTitle ? ` ${e.itemTitle}` : ''}
                </span>
                <span className="btg-mono btg-mute" style={{ fontSize: 12 }}>{relativeFromNow(e.at)}</span>
              </div>
            </div>
          ))}
        </aside>
      </main>
    </>
  );
}

function HeatRow({ name, cells, weeks }: { name: string; cells: number[]; weeks: string[] }) {
  return (
    <>
      <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      {cells.map((v, i) => (
        <span key={i} className="btg-heat-cell" style={{ background: heat(v) }} title={`${weeks[i] ?? ''} · ${v}%`} />
      ))}
    </>
  );
}

export function BtgActiveCycle() {
  const router = useRouter();
  const { data, isLoading, error } = useAdminActiveCycleOverview();
  useEffect(() => {
    if (error instanceof ApiErrorResponse && error.status === 404) router.replace(`${BTG_ADMIN_BASE}/ciclos`);
  }, [error, router]);
  if (isLoading || !data) return <Loading />;
  return <CycleView data={data} />;
}

export function BtgCycle({ id }: { id: string }) {
  const { data, isLoading } = useAdminCycleOverview(id);
  if (isLoading || !data) return <Loading />;
  return <CycleView data={data} />;
}
