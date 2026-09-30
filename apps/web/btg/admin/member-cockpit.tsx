'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminCockpit, type CockpitResponse } from '../../lib/queries/admin-cockpit';
import { useAdminMember, type MemberDetailResponse, type PlanWeekSlot } from '../../lib/queries/admin-member';
import { useAdminMocks } from '../../lib/queries/admin-mocks';
import { Avatar, Icon, Loading, Modal, OUTCOMES } from '../ui';
import { BTG_ADMIN_BASE } from './shell';
import { MemberTabs, MOCK_TYPE_LABEL } from './member-tabs';

type Range = CockpitResponse['range'];
type Status = CockpitResponse['risk']['status'];

const RISK: Record<Status, { label: string; color: string }> = {
  AT_RISK: { label: 'Em risco', color: 'var(--btg-stuck)' },
  WATCH: { label: 'Atenção', color: 'var(--btg-done-hard)' },
  ON_TRACK: { label: 'Em dia', color: 'var(--btg-done-easy)' },
};
const DOT = { ok: 'var(--btg-done-easy)', warn: 'var(--btg-done-hard)', bad: 'var(--btg-stuck)' };
// Keys are the API's breakdown labels (engagement-score.ts); values are display only.
const CRITERIA: Record<string, string> = {
  'Cohort rank': 'Posição na turma',
  'Days active': 'Dias ativos',
  'Plan completion': 'Conclusão do plano',
  'Retros submitted': 'Retros enviadas',
  'Class attendance': 'Presença em aulas',
  Recency: 'Recência',
};
const STACK = ['DONE_EASY', 'DONE_HARD', 'DOUBTS', 'STUCK'] as const;

const hours = (min: number) => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
};
const daysAgo = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
const dayLabel = (iso: string | null) => {
  if (!iso) return '—';
  const d = daysAgo(iso);
  return d === 0 ? 'hoje' : d === 1 ? 'ontem' : `${d}d`;
};
const delta = (value: number, cohort: number, unit = '') => {
  const diff = value - cohort;
  if (diff === 0) return { color: 'var(--btg-text-mute)', text: `= turma ${cohort}${unit}` };
  return {
    color: diff < 0 ? 'var(--btg-stuck)' : 'var(--btg-done-easy)',
    text: `${diff < 0 ? '↓' : '↑'} ${Math.abs(diff)}${unit} vs turma ${cohort}${unit}`,
  };
};

function Bars({ values, color = 'var(--btg-secondary)', height = 40 }: { values: number[]; color?: string; height?: number }) {
  const max = Math.max(...values, 1);
  return (
    <div className="btg-am-bars" style={{ height }}>
      {values.map((v, i) => (
        <span key={i} style={{ height: `${Math.max(8, (v / max) * 100)}%`, background: color }} title={`S${i + 1}: ${v}`} />
      ))}
    </div>
  );
}

function CardLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span className="btg-eyebrow">{children}</span>
      {right}
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const r = RISK[status];
  return (
    <span className="btg-pill" style={{ background: 'transparent', border: `1px solid ${r.color}`, color: r.color }}>
      {r.label}
    </span>
  );
}

function EngagementCard({ engagement, status }: { engagement: NonNullable<CockpitResponse['engagement']>; status: Status }) {
  const pct = engagement.cohortMedian === 0 ? 0 : Math.round(((engagement.score - engagement.cohortMedian) / engagement.cohortMedian) * 100);
  return (
    <section className="btg-card btg-card--pad">
      <CardLabel right={<StatusPill status={status} />}>Engajamento</CardLabel>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className="btg-mono btg-am-big" style={{ color: 'var(--btg-secondary)' }}>{engagement.score}</span>
        <span className="btg-mono btg-mute" style={{ fontSize: 20 }}>/100</span>
      </div>
      <span className="btg-mono" style={{ fontSize: 13, color: pct < 0 ? 'var(--btg-stuck)' : 'var(--btg-done-easy)' }}>
        {pct < 0 ? '↓' : '↑'} {Math.abs(pct)}% vs mediana da turma ({engagement.cohortMedian})
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {engagement.breakdown.map((b) => (
          <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span className="btg-dot" style={{ background: DOT[b.status] }} />
            <span className="btg-soft">{CRITERIA[b.label] ?? b.label}</span>
            <span className="btg-mono" style={{ marginLeft: 'auto' }}>{b.value} / {b.weight}</span>
          </div>
        ))}
      </div>
      {engagement.scoreByWeek.length >= 2 && (
        <div style={{ borderTop: '1px solid var(--btg-border-soft)', paddingTop: 12, marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="btg-mute" style={{ fontSize: 12 }}>Score por semana</span>
          <Bars values={engagement.scoreByWeek} height={32} />
        </div>
      )}
    </section>
  );
}

function ItemsCard({ items }: { items: CockpitResponse['itemsCompleted'] }) {
  const d = items.total - items.cohortMedian;
  // The score's "Plan completion" uses max(personal %, done / cohort median planned),
  // so a bigger-than-usual plan isn't read as underperformance.
  const oversized = items.cohortMedianPlanned > 0 && items.planned > items.cohortMedianPlanned;
  const max = Math.max(1, ...items.perWeek.map((w) => STACK.reduce((s, o) => s + (w.byOutcome[o] ?? 0), 0)));
  return (
    <section className="btg-card btg-card--pad">
      <CardLabel>Itens concluídos</CardLabel>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span className="btg-mono btg-am-big">{items.total}</span>
        <span className="btg-mute" style={{ fontSize: 15 }}>de {items.planned} planejados · {items.completionPct}%</span>
      </div>
      {d !== 0 && (
        <span className="btg-mono" style={{ fontSize: 13, color: d < 0 ? 'var(--btg-stuck)' : 'var(--btg-done-easy)' }}>
          {d < 0 ? '↓' : '↑'} {Math.abs(d)} itens vs mediana da turma ({items.cohortMedian})
        </span>
      )}
      {oversized && (
        <span className="btg-mute" style={{ fontSize: 12 }}>
          Plano acima do tamanho típico da turma ({items.cohortMedianPlanned}). O score usa a taxa relativa à turma, não o % bruto.
        </span>
      )}
      <div className="btg-am-items">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="btg-am-bars" style={{ height: 150, gap: 8 }}>
            {items.perWeek.map((w, i) => (
              <div key={w.weekStart} className="btg-am-stack" title={`Semana ${i + 1}`}>
                {STACK.map((o) => (
                  <span key={o} style={{ height: `${((w.byOutcome[o] ?? 0) / max) * 100}%`, background: OUTCOMES[o].color }} />
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {items.perWeek.map((w, i) => (
              <span key={w.weekStart} className="btg-mono btg-mute" style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>S{i + 1}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
          {[...STACK, 'SKIPPED' as const, 'PENDING' as const].map((o) => (
            <div key={o} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="btg-dot" style={{ background: OUTCOMES[o].color }} />
              <span className="btg-soft">{OUTCOMES[o].label}</span>
              <span className="btg-mono" style={{ marginLeft: 'auto' }}>{items.byOutcome[o] ?? 0}</span>
            </div>
          ))}
          {items.needsAttention.total > 0 && (
            <span style={{ color: 'var(--btg-stuck)', fontSize: 12, fontWeight: 600, borderTop: '1px solid var(--btg-border-soft)', paddingTop: 8 }}>
              Pedem atenção: {items.needsAttention.stuck} travados, {items.needsAttention.doubts} com dúvidas
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function TimeCard({ time, weeksTotal }: { time: CockpitResponse['timeInvested']; weeksTotal: number }) {
  const h = Math.round(time.actualMinutes / 60);
  const cohortH = Math.round(time.cohortMedianMinutes / 60);
  const deltaPct = cohortH === 0 ? 0 : Math.round(((h - cohortH) / cohortH) * 100);
  const vsScheduled = time.scheduledMinutes === 0 ? 0 : Math.round((time.actualMinutes / time.scheduledMinutes) * 100);
  const marker = time.scheduledMinutes === 0 ? 0 : Math.min(100, (time.cohortMedianMinutes / time.scheduledMinutes) * 100);
  const target = Math.max(...time.perWeekMinutes, 360); // 6h/semana como referência
  return (
    <section className="btg-card btg-card--pad">
      <CardLabel right={deltaPct < 0 ? <span className="btg-pill btg-pill--bad">Abaixo do plano</span> : undefined}>Tempo investido</CardLabel>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className="btg-mono btg-am-big">{time.actualMinutes < 60 ? time.actualMinutes : h}</span>
        <span className="btg-mono btg-mute" style={{ fontSize: 20 }}>{time.actualMinutes < 60 ? 'min' : 'h'}</span>
      </div>
      <span className="btg-mono" style={{ fontSize: 13, color: deltaPct < 0 ? 'var(--btg-stuck)' : 'var(--btg-done-easy)' }}>
        {deltaPct < 0 ? '↓' : '↑'} {Math.abs(deltaPct)}% · turma {cohortH}h
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span className="btg-mute">Real / agendado</span>
          <span className="btg-mono">{hours(time.actualMinutes)} / {hours(time.scheduledMinutes)} ({vsScheduled}%)</span>
        </div>
        <div className="btg-track" style={{ position: 'relative' }}>
          <div style={{ width: `${Math.min(100, vsScheduled)}%` }} />
          <span style={{ position: 'absolute', top: 0, bottom: 0, width: 2, left: `${marker}%`, background: 'var(--btg-text)' }} title={`Mediana da turma: ${cohortH}h`} />
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--btg-border-soft)', paddingTop: 12, marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span className="btg-mute">Horas por semana</span>
          <span className="btg-mute">meta 6h</span>
        </div>
        <div className="btg-am-bars">
          {Array.from({ length: weeksTotal }, (_, i) => {
            const m = time.perWeekMinutes[i] ?? 0;
            const elapsed = i < time.perWeekMinutes.length;
            return (
              <span
                key={i}
                title={elapsed ? hours(m) : 'Semana futura'}
                style={{ height: `${Math.max(8, (m / target) * 100)}%`, background: elapsed && m > 0 ? 'var(--btg-secondary)' : 'var(--btg-border-soft)' }}
              />
            );
          })}
        </div>
        {time.naoSeiCount > 0 && (
          <span className="btg-mute" style={{ fontSize: 12 }}>“Não sei” marcado em {time.naoSeiCount} {time.naoSeiCount === 1 ? 'item' : 'itens'}</span>
        )}
      </div>
    </section>
  );
}

function Behavior({ b }: { b: CockpitResponse['behavior'] }) {
  const cells: { label: string; value: string; of?: number; bars?: number[]; foot: { color: string; text: string } }[] = [
    { label: 'Sessões', value: String(b.sessions.value), bars: b.sessions.perWeek, foot: delta(b.sessions.value, b.sessions.cohortMedian) },
    { label: 'Dias ativos', value: String(b.daysActive.value), of: b.daysActive.cycleDays, bars: b.daysActive.perWeek, foot: delta(b.daysActive.value, b.daysActive.cohortMedian) },
    { label: 'Dias estudando', value: String(b.daysStudying.value), of: b.daysStudying.cycleDays, bars: b.daysStudying.perWeek, foot: delta(b.daysStudying.value, b.daysStudying.cohortMedian) },
    {
      label: 'Retros',
      value: String(b.retros.submitted),
      of: b.retros.expected,
      foot: b.retros.submitted < b.retros.expected
        ? { color: 'var(--btg-stuck)', text: `↓ ${b.retros.expected - b.retros.submitted} pendente${b.retros.expected - b.retros.submitted === 1 ? '' : 's'}` }
        : { color: 'var(--btg-done-easy)', text: 'em dia' },
    },
    { label: 'Carry-over', value: String(b.carryOver.value), bars: b.carryOver.perWeek, foot: delta(b.carryOver.value, b.carryOver.cohortMedian) },
    { label: 'Visto por último', value: dayLabel(b.lastSeen.occurredAt), foot: { color: 'var(--btg-text-mute)', text: b.lastSeen.surface ?? '—' } },
  ];
  return (
    <section className="btg-card">
      <div className="btg-card-head" style={{ padding: '14px 20px' }}>
        <span className="btg-card-title">Comportamento no ciclo</span>
        <span className="btg-mute" style={{ fontSize: 13 }}>vs mediana da turma</span>
      </div>
      <div className="btg-am-behavior">
        {cells.map((c) => (
          <div key={c.label}>
            <span className="btg-mute" style={{ fontSize: 13 }}>{c.label}</span>
            <span className="btg-mono" style={{ fontSize: 26 }}>
              {c.value}
              {c.of !== undefined && <span className="btg-mute" style={{ fontSize: 14 }}> / {c.of}</span>}
            </span>
            {c.bars && c.bars.length > 0 && <Bars values={c.bars} height={14} />}
            <span className="btg-mono" style={{ fontSize: 12, color: c.foot.color }}>{c.foot.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Topics({ topics }: { topics: CockpitResponse['topicEngagement'] }) {
  const total = topics.reduce((s, t) => s + t.minutes, 0);
  const touched = topics.filter((t) => t.minutes > 0);
  const untouched = topics.length - touched.length;
  const strongest = [...topics].sort((a, b) => b.minutes - a.minutes)[0];
  const concentration = strongest && total > 0 ? Math.round((strongest.minutes / total) * 100) : 0;
  return (
    <section className="btg-card btg-card--pad">
      <span className="btg-card-title">Engajamento por tópico</span>
      <span className="btg-soft" style={{ fontSize: 14 }}>
        <span className="btg-mono">{total < 60 ? `${total} min` : `${Math.floor(total / 60)}h`}</span> em{' '}
        <span className="btg-mono">{touched.length}</span> de <span className="btg-mono">{topics.length}</span> tópicos
        {untouched > 0 && <span style={{ color: 'var(--btg-stuck)', fontWeight: 600 }}> · {untouched} nunca abertos</span>}
      </span>
      <div>
        <div className="btg-am-topic btg-eyebrow" style={{ fontSize: 11 }}>
          <span>Tópico</span>
          <span className="btg-am-bar">Tempo investido</span>
          <span className="btg-am-num">Horas</span>
          <span className="btg-am-num">Itens</span>
          <span className="btg-am-num btg-am-cohort">vs turma</span>
        </div>
        {touched.length === 0 && <p className="btg-empty" style={{ padding: '16px 0' }}>Nenhum tempo registrado ainda.</p>}
        {touched.map((t) => {
          const pct = total === 0 ? 0 : Math.round((t.minutes / total) * 100);
          const d = t.minutes - t.cohortMedianMinutes;
          return (
            <div key={t.topicId} className="btg-am-topic">
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
              <span className="btg-am-bar" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="btg-track" style={{ flexGrow: 1 }}><div style={{ width: `${pct}%` }} /></span>
                <span className="btg-mono btg-mute" style={{ fontSize: 12, width: 36 }}>{pct}%</span>
              </span>
              <span className="btg-mono btg-am-num">{hours(t.minutes)}</span>
              <span className="btg-mono btg-am-num">{t.itemsDone}/{t.itemsPlanned}</span>
              <span className="btg-mono btg-am-num btg-am-cohort" style={{ fontSize: 12, color: d < 0 ? 'var(--btg-stuck)' : 'var(--btg-text-mute)' }}>
                {d === 0 ? 'par' : `${d < 0 ? '↓' : '↑'} ${Math.abs(Math.round(d / 60))}h`}
              </span>
            </div>
          );
        })}
      </div>
      {strongest && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, borderTop: '1px solid var(--btg-border-soft)', paddingTop: 14, fontSize: 13 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="btg-mute">Mais forte</span>
            <span><span className="btg-mono">{hours(strongest.minutes)}</span> em {strongest.label}</span>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="btg-mute">Risco de concentração</span>
            <span style={{ color: concentration >= 50 ? 'var(--btg-stuck)' : undefined }}><span className="btg-mono">{concentration}%</span> em 1 tópico</span>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="btg-mute">Referência da turma</span>
            <span>distribui em 5–6 tópicos</span>
          </span>
        </div>
      )}
    </section>
  );
}

function MocksSummary({ memberId, cycleId }: { memberId: string; cycleId: string | null }) {
  const { data, isLoading } = useAdminMocks(memberId, cycleId);
  const list = data ?? [];
  const avg = list.length ? list.reduce((s, m) => s + m.score, 0) / list.length : 0;
  const color = list.length === 0 ? 'var(--btg-text-mute)' : avg >= 4 ? 'var(--btg-done-easy)' : avg <= 2 ? 'var(--btg-stuck)' : 'var(--btg-text)';
  const counts = list.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.type]: (acc[m.type] ?? 0) + 1 }), {});
  const latest = list[0];
  return (
    <section className="btg-card btg-card--pad" style={{ padding: 20 }}>
      <CardLabel>Mocks</CardLabel>
      <span>
        <span className="btg-mono" style={{ fontSize: 36, color }}>{isLoading || list.length === 0 ? '—' : avg.toFixed(1)}</span>
        <span className="btg-mono btg-mute"> /5.0</span>
      </span>
      <span className="btg-mute" style={{ fontSize: 13 }}>
        {list.length} {list.length === 1 ? 'mock' : 'mocks'}
        {Object.entries(counts).map(([t, n]) => ` · ${MOCK_TYPE_LABEL[t as keyof typeof MOCK_TYPE_LABEL]} ${n}`).join('')}
      </span>
      {latest && (
        <span style={{ fontSize: 13, borderTop: '1px solid var(--btg-border-soft)', paddingTop: 10 }}>
          Último: {new Date(latest.conductedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} · {MOCK_TYPE_LABEL[latest.type]}{' '}
          <span className="btg-mono">{latest.score}/5</span>
        </span>
      )}
    </section>
  );
}

function SessionPattern({ b }: { b: CockpitResponse['behavior'] }) {
  const since = b.lastSeen.occurredAt ? daysAgo(b.lastSeen.occurredAt) : null;
  const cold = since !== null && since >= 7;
  return (
    <section className="btg-card btg-card--pad" style={{ padding: 20 }}>
      <CardLabel right={cold ? <span className="btg-pill btg-pill--bad">{since}d parado</span> : undefined}>Padrão de sessões</CardLabel>
      <span className="btg-soft" style={{ fontSize: 14 }}>
        <span className="btg-mono">{b.sessions.value}</span> sessões em <span className="btg-mono">{b.daysActive.value}</span> dias
      </span>
      {b.sessions.perWeek.length > 0 && (
        <>
          <Bars values={b.sessions.perWeek} height={56} color="var(--btg-blue-300)" />
          <div className="btg-mute" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span>início do ciclo</span>
            {since !== null && <span style={{ color: cold ? 'var(--btg-stuck)' : undefined }}>visto há {since}d</span>}
            <span>agora</span>
          </div>
        </>
      )}
    </section>
  );
}

function Attendance({ c, first, cycle }: { c: CockpitResponse['classAttendance']; first: CockpitResponse['firstSession']; cycle: CockpitResponse['cycle'] }) {
  const missed = c.total - c.present;
  return (
    <section className="btg-card btg-card--pad" style={{ padding: 20 }}>
      <CardLabel right={<span className="btg-mono btg-mute" style={{ fontSize: 12 }}>turma {c.cohortPresent}/{c.total}</span>}>Presença em aulas</CardLabel>
      <span><span className="btg-mono" style={{ fontSize: 30 }}>{c.present}</span><span className="btg-mono btg-mute"> / {c.total}</span></span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {c.sessions.map((s, i) => (
          <span
            key={i}
            className="btg-am-tile"
            style={{ width: 20, height: 20, background: s.status === 'PRESENT' ? 'var(--btg-secondary)' : 'var(--btg-border-soft)' }}
            title={new Date(s.scheduledAt).toLocaleDateString('pt-BR')}
          />
        ))}
        {missed > 0 && <span className="btg-mute" style={{ marginLeft: 'auto', fontSize: 12 }}>{missed} {missed === 1 ? 'falta' : 'faltas'}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px solid var(--btg-border-soft)', paddingTop: 10, fontSize: 13 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="btg-mute">Primeira sessão</span>
          <span className="btg-mono">
            {first ? new Date(first.occurredAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : '—'} · dia {first?.dayOfCycle ?? '—'}
          </span>
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="btg-mute">Progresso do ciclo</span>
          <span className="btg-mono">
            S{cycle?.weekNumber ?? '?'}/{cycle?.weeksTotal ?? '?'} · {cycle ? Math.round((cycle.weekNumber / cycle.weeksTotal) * 100) : 0}%
          </span>
        </span>
      </div>
    </section>
  );
}

function Activity({ events }: { events: CockpitResponse['recentActivity'] }) {
  return (
    <section className="btg-card btg-card--pad" style={{ padding: 20 }}>
      <CardLabel right={<span className="btg-mute" style={{ fontSize: 12 }}>últimos 30 dias</span>}>Atividade recente</CardLabel>
      {events.length === 0 && <span className="btg-mute" style={{ fontSize: 14 }}>Nenhuma atividade registrada.</span>}
      {events.map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, fontSize: 13, alignItems: 'baseline' }}>
          <span className="btg-mono btg-mute" style={{ width: 44, flexShrink: 0 }}>{dayLabel(e.occurredAt)}</span>
          <span className="btg-soft" style={{ minWidth: 0 }}>{e.label}</span>
        </div>
      ))}
    </section>
  );
}

function PlanWeekModal({ open, onClose, weeks, onPick }: { open: boolean; onClose: () => void; weeks: MemberDetailResponse['planWeeks']; onPick: (s: PlanWeekSlot) => void }) {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (
    <Modal open={open} onClose={onClose} title="Planejar semana" width={480}>
      {([['Semana atual', weeks.current], ['Próxima semana', weeks.next]] as const).map(([label, slot]) => {
        const hasPlan = slot.planId !== null;
        const disabled = !slot.inCycle && !hasPlan;
        return (
          <button key={label} type="button" className="btg-am-slot" disabled={disabled} onClick={() => onPick(slot)}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
              <span className="btg-eyebrow">{label}</span>
              <span style={{ fontSize: 16 }}>{fmt(slot.weekStart)} → {fmt(slot.weekEnd)}</span>
              <span className="btg-mute" style={{ fontSize: 13 }}>
                {disabled ? 'Fora do ciclo' : hasPlan ? `Editar plano existente · ${slot.status === 'PUBLISHED' ? 'publicado' : 'rascunho'}` : 'Criar novo plano'}
              </span>
            </span>
            {!disabled && <Icon name="arrow_forward" style={{ color: 'var(--btg-primary)' }} />}
          </button>
        );
      })}
    </Modal>
  );
}

function CyclePicker({ memberships, selected, onSelect }: { memberships: MemberDetailResponse['memberships']; selected: string | null; onSelect: (id: string) => void }) {
  // ACTIVE first, then ARCHIVED; newest first inside each group.
  const sorted = [...memberships].sort((a, b) =>
    a.status !== b.status ? (a.status === 'ACTIVE' ? -1 : 1) : new Date(b.cycleStartsAt).getTime() - new Date(a.cycleStartsAt).getTime(),
  );
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {sorted.map((m) => (
        <button key={m.cycleId} type="button" className="btg-am-chip" aria-pressed={selected === m.cycleId} onClick={() => onSelect(m.cycleId)}>
          {m.cycleName}
          {m.status === 'ARCHIVED' && ' (arquivado)'}
        </button>
      ))}
    </div>
  );
}

export function BtgMemberCockpit({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('cycle');
  const [planOpen, setPlanOpen] = useState(false);
  const { data, isLoading, error } = useAdminCockpit(memberId, cycleId, range);
  const { data: raw } = useAdminMember(memberId, cycleId);

  const back = (
    <Link href={`${BTG_ADMIN_BASE}/membros`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
      <Icon name="arrow_back" style={{ fontSize: 16 }} />
      Membros
    </Link>
  );

  if (isLoading) return <Loading />;
  if (error || !data) {
    return (
      <main className="btg-am-main">
        {back}
        <div className="btg-notice btg-notice--bad">
          <Icon name="error" />
          Não foi possível carregar o cockpit. {error instanceof Error ? error.message : ''}
        </div>
      </main>
    );
  }

  const { member, cycle, risk } = data;
  const effectiveCycle = cycleId ?? cycle?.id ?? null;
  const wa = member.whatsappPhone ? `https://wa.me/${member.whatsappPhone.replace(/[^0-9]/g, '')}` : null;

  function pick(slot: PlanWeekSlot) {
    setPlanOpen(false);
    router.push(
      slot.planId
        ? `${BTG_ADMIN_BASE}/member/${memberId}/plan/${slot.planId}`
        : `${BTG_ADMIN_BASE}/member/${memberId}/plan/new?weekStart=${slot.weekStart.slice(0, 10)}`,
    );
  }

  return (
    <>
      <header className="btg-admin-header">
        <div className="btg-admin-header-title">
          {back}
          <span>{member.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="btg-am-seg" role="group" aria-label="Período">
            {(['7d', 'cycle', 'all'] as const).map((r) => (
              <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
                {r === '7d' ? '7 dias' : r === 'cycle' ? 'Ciclo' : 'Tudo'}
              </button>
            ))}
          </div>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btg-btn btg-btn--outline btg-btn--sm">
              <Icon name="chat" />
              WhatsApp
            </a>
          )}
          <button type="button" className="btg-btn btg-btn--primary btg-btn--sm" onClick={() => setPlanOpen(true)} disabled={!raw}>
            <Icon name="edit_calendar" />
            Planejar semana
          </button>
        </div>
      </header>

      <main className="btg-am-main">
        <section className="btg-card" style={{ padding: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="btg-am-avatar-lg"><Avatar name={member.name} pictureUrl={member.pictureUrl} /></span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flexGrow: 1 }}>
            <span className="btg-soft" style={{ fontSize: 14 }}>
              {member.track ? member.track.replace(/_/g, ' ') : 'Sem trilha'}
              {cycle && ` · ${cycle.name} · semana ${cycle.weekNumber} de ${cycle.weeksTotal}`}
            </span>
            <span className="btg-mono btg-mute" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{member.email}</span>
            {raw && raw.memberships.length > 1 && <CyclePicker memberships={raw.memberships} selected={effectiveCycle} onSelect={setCycleId} />}
          </div>
          <StatusPill status={risk.status} />
        </section>

        {risk.status !== 'ON_TRACK' && (
          <div className="btg-card btg-am-risk" style={{ borderLeftColor: RISK[risk.status].color }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: RISK[risk.status].color }}>
              <Icon name="warning" style={{ fontSize: 18 }} />
              {RISK[risk.status].label}
            </span>
            <span className="btg-soft">{risk.reasons.join(' · ')}</span>
          </div>
        )}

        {/* Engagement is null on range=all: the score only exists inside one cycle. */}
        <div className={`btg-am-grid ${data.engagement ? 'btg-am-grid--kpi' : 'btg-am-grid--kpi-noeng'}`}>
          {data.engagement && <EngagementCard engagement={data.engagement} status={risk.status} />}
          <ItemsCard items={data.itemsCompleted} />
          <TimeCard time={data.timeInvested} weeksTotal={cycle?.weeksTotal ?? 9} />
        </div>

        <Behavior b={data.behavior} />

        <div className="btg-am-grid btg-am-grid--split">
          <Topics topics={data.topicEngagement} />
          <div className="btg-stack" style={{ gap: 16 }}>
            <MocksSummary memberId={memberId} cycleId={effectiveCycle} />
            <SessionPattern b={data.behavior} />
            <Attendance c={data.classAttendance} first={data.firstSession} cycle={data.cycle} />
            <Activity events={data.recentActivity} />
          </div>
        </div>

        {raw && <MemberTabs memberId={memberId} cycleId={effectiveCycle} detail={raw} />}
      </main>

      {raw && <PlanWeekModal open={planOpen} onClose={() => setPlanOpen(false)} weeks={raw.planWeeks} onPick={pick} />}
    </>
  );
}
