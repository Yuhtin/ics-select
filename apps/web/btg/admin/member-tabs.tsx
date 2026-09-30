'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { isPositiveOutcome, type ItemOutcome } from '@ics-select/shared';
import { useAdminMemberDiagnose, type MemberDetailResponse } from '../../lib/queries/admin-member';
import { useAdminNotes, useCreateNote, useDeleteNote, useUpdateNote, type AdminNote } from '../../lib/queries/admin-notes';
import { MOCK_TYPES, useAdminMocks, useCreateMock, useDeleteMock, useUpdateMock, type AdminMock, type MockType } from '../../lib/queries/admin-mocks';
import { PHASES, topicPhase, type PhaseKey } from '../../lib/topics/phase';
import { Icon, Modal, OUTCOMES } from '../ui';
import { BTG_ADMIN_BASE } from './shell';

type Tab = 'timeline' | 'retros' | 'coverage' | 'diagnose' | 'mocks' | 'notes' | 'attendance';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'timeline', label: 'Linha do tempo', icon: 'timeline' },
  { key: 'retros', label: 'Retros', icon: 'edit_note' },
  { key: 'coverage', label: 'Cobertura', icon: 'grid_view' },
  { key: 'diagnose', label: 'Diagnóstico IA', icon: 'auto_awesome' },
  { key: 'mocks', label: 'Mocks', icon: 'record_voice_over' },
  { key: 'notes', label: 'Notas', icon: 'sticky_note_2' },
  { key: 'attendance', label: 'Presença', icon: 'school' },
];

export const MOCK_TYPE_LABEL: Record<MockType, string> = { BEHAVIORAL: 'Comportamental', CODING: 'Coding', SYSTEM_DESIGN: 'System Design' };
const SCORE_LABEL: Record<number, string> = { 1: 'No Hire', 2: 'Lean No', 3: 'Borderline', 4: 'Lean Hire', 5: 'Strong Hire' };
const PHASE_LABEL: Record<PhaseKey, string> = {
  foundations: 'Fundamentos',
  algorithms: 'Algoritmos e ED',
  engineering: 'Fund. de engenharia',
  'sd-blocks': 'SD · Blocos',
  'sd-concepts': 'SD · Conceitos',
  'sd-cases': 'SD · Estudos de caso',
};

// Dates stored as UTC midnight (weekStart, class times) render in UTC so they don't slip a day.
const dateUtc = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Date(iso).toLocaleDateString('pt-BR', { ...opts, timeZone: 'UTC' });
const dateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function MemberTabs({ memberId, cycleId, detail }: { memberId: string; cycleId: string | null; detail: MemberDetailResponse }) {
  const [tab, setTab] = useState<Tab>('timeline');
  return (
    <section className="btg-card">
      <div className="btg-tabs btg-am-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            <Icon name={t.icon} style={{ fontSize: 18 }} />
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ padding: 24 }}>
        {tab === 'timeline' && <Timeline memberId={memberId} plans={detail.timeline} />}
        {tab === 'retros' && <Retros retros={detail.retros} />}
        {tab === 'coverage' && <Coverage topics={detail.topicCoverage} />}
        {tab === 'diagnose' && <Diagnose memberId={memberId} />}
        {tab === 'mocks' && <Mocks memberId={memberId} cycleId={cycleId} />}
        {tab === 'notes' && <Notes memberId={memberId} />}
        {tab === 'attendance' && <AttendanceList attendance={detail.attendance} />}
      </div>
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="btg-mute" style={{ fontSize: 14 }}>{children}</p>;

function Timeline({ memberId, plans }: { memberId: string; plans: MemberDetailResponse['timeline'] }) {
  if (plans.length === 0) return <Empty>Nenhum plano ainda.</Empty>;
  return (
    <div className="btg-stack">
      {plans.map((plan) => {
        const done = plan.items.filter((i) => isPositiveOutcome(i.outcome)).length;
        const skipped = plan.items.filter((i) => i.outcome === 'SKIPPED').length;
        const href = `${BTG_ADMIN_BASE}/member/${memberId}/plan/${plan.planId}`;
        return (
          <article key={plan.planId}>
            <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingBottom: 8, borderBottom: '1px solid var(--btg-border)' }}>
              <Link href={href} style={{ fontSize: 17, color: 'var(--btg-text)' }}>Semana de {dateUtc(plan.weekStart)}</Link>
              <span className={plan.status === 'PUBLISHED' ? 'btg-pill' : 'btg-pill btg-pill--neutral'}>{plan.status === 'PUBLISHED' ? 'Publicado' : 'Rascunho'}</span>
              <span className="btg-mono btg-mute" style={{ fontSize: 13 }}>
                {done}/{plan.items.length}
                {skipped > 0 && ` (${skipped} pulados)`}
              </span>
              <Link href={href} className="btg-btn btg-btn--ghost btg-btn--sm" style={{ marginLeft: 'auto', height: 32 }}>
                <Icon name="edit" style={{ fontSize: 18 }} />
                Abrir editor
              </Link>
            </header>
            {plan.items.map((item) => (
              <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--btg-border-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}>
                  <span className="btg-dot" style={{ background: OUTCOMES[item.outcome].color }} title={OUTCOMES[item.outcome].label} />
                  <span style={{ flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                  <span className="btg-mute btg-row-time" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{OUTCOMES[item.outcome].label}</span>
                  <span className="btg-mute btg-row-topic" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{item.topicLabel ?? '—'}</span>
                  <Link href={`${BTG_ADMIN_BASE}/acervo?q=${encodeURIComponent(item.title)}`} aria-label={`Ver ${item.title} no acervo`} style={{ display: 'inline-flex' }}>
                    <Icon name="open_in_new" style={{ fontSize: 16 }} />
                  </Link>
                </div>
                {item.reflection && <Reflection outcome={item.outcome} text={item.reflection} />}
              </div>
            ))}
          </article>
        );
      })}
    </div>
  );
}

function Reflection({ outcome, text }: { outcome: ItemOutcome; text: string }) {
  const label = outcome === 'STUCK' ? 'Travou, precisa de ajuda' : outcome === 'DOUBTS' ? 'Ficou com dúvidas' : 'Nota do membro';
  const color = outcome === 'STUCK' || outcome === 'DOUBTS' ? OUTCOMES[outcome].color : 'var(--btg-border)';
  return (
    <div className="btg-am-quote" style={{ borderLeftColor: color }}>
      <span className="btg-eyebrow" style={{ display: 'block', fontStyle: 'normal', fontSize: 11, color: outcome === 'STUCK' || outcome === 'DOUBTS' ? color : undefined }}>{label}</span>
      “{text}”
    </div>
  );
}

function Retros({ retros }: { retros: MemberDetailResponse['retros'] }) {
  const [openId, setOpenId] = useState<string | null>(retros[0]?.id ?? null);
  if (retros.length === 0) return <Empty>Nenhuma retro enviada ainda.</Empty>;
  const block = (label: string, text: string, linked?: { title: string; outcome: string } | null) => (
    <div className="btg-am-quote" style={{ borderLeftColor: 'var(--btg-secondary)', margin: 0 }}>
      <span className="btg-eyebrow" style={{ display: 'block', fontStyle: 'normal', fontSize: 11, color: 'var(--btg-secondary)' }}>{label}</span>
      {linked && <span className="btg-mute" style={{ display: 'block', fontStyle: 'normal', fontSize: 12 }}>→ {linked.title} [{OUTCOMES[linked.outcome as ItemOutcome]?.label ?? linked.outcome}]</span>}
      “{text}”
    </div>
  );
  return (
    <div className="btg-stack" style={{ gap: 12 }}>
      {retros.map((r) => {
        const open = openId === r.id;
        return (
          <article key={r.id} className="btg-card">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : r.id)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'none', border: 0, textAlign: 'left', color: 'inherit' }}
            >
              <span style={{ fontSize: 16 }}>Semana de {dateUtc(r.weekStart)}</span>
              <span className="btg-mute" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                enviada em {new Date(r.submittedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                <Icon name={open ? 'expand_less' : 'expand_more'} />
              </span>
            </button>
            {open && (
              <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {r.whatClicked && block('O que fez sentido', r.whatClicked, r.valuedItem)}
                {r.whatStuck && block('Onde travou', r.whatStuck, r.stuckItem)}
                {r.nextWeekWish && block('Desejo para a próxima semana', r.nextWeekWish)}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

const TIER = (planned: number, done: number) =>
  planned === 0 ? 'var(--btg-border-soft)' : done / planned >= 1 ? 'var(--btg-secondary)' : done / planned >= 0.5 ? 'var(--btg-blue-300)' : 'var(--btg-blue-100)';

function Coverage({ topics }: { topics: MemberDetailResponse['topicCoverage'] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const phases = useMemo(
    () =>
      PHASES.map((p) => {
        const arr = topics.filter((t) => topicPhase(t.order) === p.key).sort((a, b) => a.order - b.order);
        const planned = arr.reduce((s, t) => s + t.itemsPlanned, 0);
        const done = arr.reduce((s, t) => s + t.itemsDone, 0);
        return { key: p.key, topics: arr, planned, done, covered: arr.filter((t) => t.itemsPlanned > 0).length };
      }).filter((p) => p.topics.length > 0),
    [topics],
  );
  const active = topics.filter((t) => t.itemsPlanned > 0 || t.itemsDone > 0).sort((a, b) => b.itemsDone - a.itemsDone || b.itemsPlanned - a.itemsPlanned);

  return (
    <div className="btg-stack">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
        {phases.map((p) => (
          <div key={p.key} className="btg-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="btg-eyebrow" style={{ fontSize: 11 }}>{PHASE_LABEL[p.key]}</span>
            <span className="btg-mono" style={{ fontSize: 22 }}>{p.planned ? `${Math.round((p.done / p.planned) * 100)}%` : '—'}</span>
            <span className="btg-track btg-track--thin"><div style={{ width: `${p.planned ? (p.done / p.planned) * 100 : 0}%` }} /></span>
            <span className="btg-mono btg-mute" style={{ fontSize: 12 }}>{p.done}/{p.planned} feitos</span>
          </div>
        ))}
      </div>
      <div className="btg-am-grid btg-am-grid--coverage">
        <div className="btg-stack" style={{ gap: 12 }}>
          {phases.map((p) => (
            <div key={p.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span className="btg-eyebrow" style={{ fontSize: 11 }}>{PHASE_LABEL[p.key]}</span>
                <span className="btg-mono btg-mute">{p.covered}/{p.topics.length} cobertos · {p.done}/{p.planned}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {p.topics.map((t) => (
                  <span
                    key={t.topicId}
                    className="btg-am-tile"
                    title={`${t.topicLabel}: ${t.itemsDone}/${t.itemsPlanned}`}
                    onMouseEnter={() => setSelected(t.topicId)}
                    onMouseLeave={() => setSelected(null)}
                    style={{ background: TIER(t.itemsPlanned, t.itemsDone), outline: selected === t.topicId ? '2px solid var(--btg-primary)' : undefined }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="btg-mute" style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            menos
            {[[0, 0], [2, 0], [2, 1], [1, 1]].map(([pl, d], i) => <span key={i} style={{ width: 12, height: 12, borderRadius: 2, background: TIER(pl, d) }} />)}
            mais
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="btg-eyebrow" style={{ fontSize: 11 }}>Tópicos ativos · por esforço</span>
            <span className="btg-mono btg-mute" style={{ fontSize: 12 }}>{active.length}</span>
          </div>
          {active.length === 0 && <Empty>Sem atividade neste ciclo.</Empty>}
          {active.map((t) => (
            <div
              key={t.topicId}
              className="btg-am-list-row"
              onMouseEnter={() => setSelected(t.topicId)}
              onMouseLeave={() => setSelected(null)}
              style={{ padding: '8px 6px', background: selected === t.topicId ? 'var(--btg-bg)' : undefined }}
            >
              <span style={{ flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.topicLabel}</span>
              <span className="btg-track btg-track--thin" style={{ width: 64 }}><div style={{ width: `${t.itemsPlanned ? (t.itemsDone / t.itemsPlanned) * 100 : 0}%` }} /></span>
              <span className="btg-mono btg-mute" style={{ fontSize: 12, width: 36, textAlign: 'right' }}>{t.itemsDone}/{t.itemsPlanned}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Diagnose({ memberId }: { memberId: string }) {
  const [enabled, setEnabled] = useState(false);
  const { data, isLoading, isFetching, refetch } = useAdminMemberDiagnose(memberId, enabled);

  if (!enabled) {
    return (
      <div className="btg-card btg-card--ai" style={{ alignItems: 'flex-start', gap: 12 }}>
        <span className="btg-ai-label"><Icon name="auto_awesome" />Diagnóstico com IA</span>
        <p className="btg-soft" style={{ fontSize: 15, maxWidth: 560 }}>
          Gere uma análise da trajetória deste membro no ciclo: ritmo, tópicos, travas e o próximo passo recomendado.
        </p>
        <button type="button" className="btg-btn btg-btn--primary btg-btn--sm" onClick={() => setEnabled(true)}>
          <Icon name="auto_awesome" />
          Gerar diagnóstico
        </button>
      </div>
    );
  }
  if (isLoading || isFetching) return <p className="btg-eyebrow">Analisando… (pode levar 10 a 15 s)</p>;
  if (!data) return <div className="btg-notice btg-notice--bad"><Icon name="error" />Não foi possível gerar o diagnóstico.</div>;

  return (
    <div className="btg-card btg-card--ai" style={{ gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="btg-ai-label"><Icon name="auto_awesome" />Diagnóstico · gerado em {dateTime(data.cachedAt)}</span>
        <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" style={{ height: 32 }} onClick={() => refetch()}>
          <Icon name="refresh" style={{ fontSize: 18 }} />
          Gerar de novo
        </button>
      </div>
      {(data.markdown ?? '').split('\n\n').filter((p) => p.trim()).map((p, i) => (
        <p key={i} style={{ fontSize: 15, lineHeight: '24px' }}>{p}</p>
      ))}
    </div>
  );
}

type Draft = { type: MockType; score: number; conductedAt: string; conductedBy: string; topicsInput: string; feedback: string };
const emptyDraft = (): Draft => ({ type: 'CODING', score: 3, conductedAt: todayIso(), conductedBy: '', topicsInput: '', feedback: '' });
const parseTopics = (raw: string) => raw.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);

function Mocks({ memberId, cycleId }: { memberId: string; cycleId: string | null }) {
  const { data: mocks } = useAdminMocks(memberId, cycleId);
  const create = useCreateMock();
  const update = useUpdateMock();
  const remove = useDeleteMock();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminMock | null>(null);
  const canSubmit = Boolean(cycleId) && draft.score >= 1 && draft.score <= 5;
  const pending = create.isPending || update.isPending;

  function submit() {
    if (!cycleId || !canSubmit) return;
    const fields = {
      type: draft.type,
      score: draft.score,
      feedback: draft.feedback.trim() || undefined,
      conductedBy: draft.conductedBy.trim() || undefined,
      conductedAt: new Date(draft.conductedAt).toISOString(),
      topics: parseTopics(draft.topicsInput),
    };
    const reset = () => {
      setDraft(emptyDraft());
      setEditingId(null);
    };
    if (editingId) update.mutate({ id: editingId, userId: memberId, ...fields }, { onSuccess: reset });
    else create.mutate({ userId: memberId, cycleId, ...fields }, { onSuccess: reset });
  }

  return (
    <div className="btg-stack">
      {!cycleId && <div className="btg-notice btg-notice--bad"><Icon name="error" />Selecione um ciclo para registrar mocks.</div>}
      <fieldset className="btg-card" style={{ margin: 0, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--btg-bg)' }}>
        <legend className="btg-eyebrow" style={{ padding: '0 6px' }}>{editingId ? 'Editar mock' : 'Novo mock'}</legend>
        <div className="btg-am-form">
          <label className="btg-field">
            Tipo
            <select className="btg-select" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as MockType })}>
              {MOCK_TYPES.map((t) => <option key={t} value={t}>{MOCK_TYPE_LABEL[t]}</option>)}
            </select>
          </label>
          <div className="btg-field">
            Nota · {draft.score} {SCORE_LABEL[draft.score]}
            <div className="btg-am-seg" role="group" aria-label="Nota">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className="btg-mono" title={`${n} · ${SCORE_LABEL[n]}`} aria-pressed={draft.score === n} onClick={() => setDraft({ ...draft, score: n })} style={{ flex: 1 }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="btg-field">
            Data
            <input type="date" className="btg-input" value={draft.conductedAt} onChange={(e) => setDraft({ ...draft, conductedAt: e.target.value })} />
          </label>
          <label className="btg-field">
            Conduzido por
            <input className="btg-input" value={draft.conductedBy} onChange={(e) => setDraft({ ...draft, conductedBy: e.target.value })} placeholder="Nome do mentor (opcional)" />
          </label>
          <label className="btg-field btg-am-span2">
            Tópicos (separados por vírgula)
            <input className="btg-input" value={draft.topicsInput} onChange={(e) => setDraft({ ...draft, topicsInput: e.target.value })} placeholder="tree, recursion, base-cases" />
          </label>
        </div>
        <label className="btg-field">
          Feedback
          <textarea className="btg-textarea" rows={3} value={draft.feedback} onChange={(e) => setDraft({ ...draft, feedback: e.target.value })} placeholder="O que funcionou, onde travou, padrões observados…" />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {editingId && (
            <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={() => { setEditingId(null); setDraft(emptyDraft()); }}>Cancelar</button>
          )}
          <button type="button" className="btg-btn btg-btn--primary btg-btn--sm" onClick={submit} disabled={!canSubmit || pending}>
            {pending ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Adicionar mock'}
          </button>
        </div>
      </fieldset>

      {!mocks || mocks.length === 0 ? (
        <Empty>Nenhum mock registrado ainda.</Empty>
      ) : (
        mocks.map((m) => (
          <article key={m.id} className="btg-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="btg-mute" style={{ fontSize: 13 }}>
                  {new Date(m.conductedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })} · {MOCK_TYPE_LABEL[m.type]}
                  {m.conductedBy && ` · ${m.conductedBy}`}
                </span>
                <span>
                  <span className="btg-mono" style={{ fontSize: 22 }}>{m.score}</span>
                  <span className="btg-mono btg-mute">/5</span>
                  <span className="btg-mute" style={{ fontSize: 13, marginLeft: 8 }}>{SCORE_LABEL[m.score]}</span>
                </span>
              </div>
              <div style={{ display: 'flex' }}>
                <button type="button" className="btg-icon-btn" aria-label="Editar mock" onClick={() => {
                  setEditingId(m.id);
                  setDraft({ type: m.type, score: m.score, conductedAt: m.conductedAt.slice(0, 10), conductedBy: m.conductedBy ?? '', topicsInput: m.topics.join(', '), feedback: m.feedback ?? '' });
                }}>
                  <Icon name="edit" />
                </button>
                <button type="button" className="btg-icon-btn" aria-label="Apagar mock" onClick={() => setDeleteTarget(m)}>
                  <Icon name="delete" />
                </button>
              </div>
            </div>
            {m.topics.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {m.topics.map((t) => <span key={t} className="btg-pill btg-pill--neutral">{t}</span>)}
              </div>
            )}
            {m.feedback && <p className="btg-soft" style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.feedback}</p>}
          </article>
        ))
      )}

      <ConfirmDelete
        open={deleteTarget !== null}
        title="Apagar mock?"
        busy={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate({ id: deleteTarget.id, userId: memberId }, { onSettled: () => setDeleteTarget(null) })}
      />
    </div>
  );
}

function Notes({ memberId }: { memberId: string }) {
  const { data: notes } = useAdminNotes(memberId);
  const create = useCreateNote();
  const update = useUpdateNote();
  const remove = useDeleteNote();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminNote | null>(null);

  return (
    <div className="btg-stack">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea className="btg-textarea" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Nota privada sobre este membro…" aria-label="Nova nota" />
        <button
          type="button"
          className="btg-btn btg-btn--primary btg-btn--sm"
          style={{ alignSelf: 'flex-end' }}
          disabled={!draft.trim() || create.isPending}
          onClick={() => create.mutate({ aboutId: memberId, text: draft.trim() }, { onSuccess: () => setDraft('') })}
        >
          {create.isPending ? 'Salvando…' : 'Adicionar nota'}
        </button>
      </div>
      {!notes || notes.length === 0 ? (
        <Empty>Nenhuma nota ainda.</Empty>
      ) : (
        notes.map((note) => (
          <article key={note.id} className="btg-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span className="btg-mono btg-mute" style={{ fontSize: 12 }}>{dateTime(note.createdAt)}</span>
              {editingId !== note.id && (
                <div style={{ display: 'flex' }}>
                  <button type="button" className="btg-icon-btn" aria-label="Editar nota" onClick={() => { setEditingId(note.id); setEditText(note.text); }}>
                    <Icon name="edit" />
                  </button>
                  <button type="button" className="btg-icon-btn" aria-label="Apagar nota" onClick={() => setDeleteTarget(note)}>
                    <Icon name="delete" />
                  </button>
                </div>
              )}
            </div>
            {editingId === note.id ? (
              <>
                <textarea className="btg-textarea" rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} aria-label="Editar nota" />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={() => { setEditingId(null); setEditText(''); }}>Cancelar</button>
                  <button
                    type="button"
                    className="btg-btn btg-btn--primary btg-btn--sm"
                    disabled={!editText.trim() || update.isPending}
                    onClick={() => update.mutate({ id: note.id, aboutId: memberId, text: editText.trim() }, { onSuccess: () => { setEditingId(null); setEditText(''); } })}
                  >
                    Salvar
                  </button>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 15, lineHeight: '22px', whiteSpace: 'pre-wrap' }}>{note.text}</p>
            )}
          </article>
        ))
      )}
      <ConfirmDelete
        open={deleteTarget !== null}
        title="Apagar nota?"
        busy={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate({ id: deleteTarget.id, aboutId: memberId }, { onSettled: () => setDeleteTarget(null) })}
      />
    </div>
  );
}

function ConfirmDelete({ open, title, busy, onClose, onConfirm }: { open: boolean; title: string; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      width={420}
      footer={
        <>
          <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="button" className="btg-btn btg-btn--primary btg-btn--sm" onClick={onConfirm} disabled={busy}>{busy ? 'Apagando…' : 'Apagar'}</button>
        </>
      }
    >
      <p style={{ fontSize: 15 }}>Essa ação não pode ser desfeita.</p>
    </Modal>
  );
}

const ATTENDANCE = {
  PRESENT: { label: 'Presente', color: 'var(--btg-done-easy)' },
  LATE: { label: 'Atrasado', color: 'var(--btg-done-hard)' },
  ABSENT: { label: 'Ausente', color: 'var(--btg-stuck)' },
};

function AttendanceList({ attendance }: { attendance: MemberDetailResponse['attendance'] }) {
  if (attendance.length === 0) return <Empty>Nenhuma aula agendada neste ciclo ainda.</Empty>;
  return (
    <div>
      {attendance.map((c) => (
        <div key={c.classId} className="btg-am-list-row">
          <span className="btg-mono btg-mute" style={{ width: 96, flexShrink: 0, fontSize: 12, display: 'flex', flexDirection: 'column' }}>
            <span>{dateUtc(c.scheduledAt, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span>{new Date(c.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}</span>
          </span>
          <span style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.classTitle}</span>
            {c.topic && <span className="btg-mute" style={{ fontSize: 12 }}>{c.topic}</span>}
          </span>
          <span className="btg-mono btg-mute btg-row-time" style={{ fontSize: 12 }}>{c.durationMin} min</span>
          <span style={{ width: 90, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', fontSize: 13, color: c.status ? ATTENDANCE[c.status].color : 'var(--btg-text-mute)' }}>
            {c.status && <span className="btg-dot" style={{ background: ATTENDANCE[c.status].color }} />}
            {c.status ? ATTENDANCE[c.status].label : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
