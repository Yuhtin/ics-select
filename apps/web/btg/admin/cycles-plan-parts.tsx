'use client';

import { useMemo, useState } from 'react';
import type { ItemOutcome } from '@ics-select/shared';
import type { AdminLibraryItem } from '../../lib/queries/admin-library';
import type { Topic } from '../../lib/queries/admin-topics';
import type { PlanContextResponse } from '../../lib/queries/admin-plan-context';
import type { SchedulingPlacement, WeeklyPlanItem } from '../../lib/queries/admin-plan-editor';
import type { PreviewBusyBlock } from '../../lib/queries/admin-plan-preview';
import { fuseFilter } from '../../lib/library/fuse-index';
import { computeDayFreeMinutes } from '../../lib/scheduling/day-free';
import { bucketBusyByLocalDay } from '../../lib/scheduling/busy-by-day';
import { DIFFICULTY, Icon, OUTCOMES, minutesLabel, platformOf } from '../ui';

// ---------- budget ----------

/** Planned vs budget (historical) + pending vs remaining capacity (actionable). Port of BudgetBadge. */
export function BudgetLine({
  planned,
  budget,
  remaining,
  pending,
  daysRemaining,
}: {
  planned: number;
  budget: number;
  remaining: number | null;
  pending: number;
  daysRemaining: number;
}) {
  if (budget === 0) return <span className="btg-ac-meta">Membro ainda não declarou disponibilidade.</span>;
  const pct = Math.round((planned / budget) * 100);
  const tone = (ok: boolean, warn: boolean) => (ok ? 'var(--btg-done-easy)' : warn ? 'var(--btg-done-hard)' : 'var(--btg-stuck)');
  if (remaining === null) {
    const label = pct <= 80 ? 'Cabe na disponibilidade' : pct <= 100 ? 'Perto do limite' : 'Acima do orçamento';
    return (
      <span className="btg-mono" style={{ fontSize: 13, color: tone(pct <= 80, pct <= 100) }}>
        {label} · {planned}/{budget} min ({pct}%)
      </span>
    );
  }
  const headroom = remaining - pending;
  const days = `${daysRemaining} ${daysRemaining === 1 ? 'dia restante' : 'dias restantes'}`;
  const [label, detail, color] =
    pending === 0 && daysRemaining === 0
      ? ['Semana concluída', '', 'var(--btg-text-mute)']
      : pending === 0
        ? ['Tudo em dia', `${remaining} min livres · ${days}`, tone(true, true)]
        : headroom >= 0
          ? ['Cabe no que resta', `${headroom} min de folga · ${days}`, tone(true, true)]
          : -headroom <= 30
            ? ['Apertado', `${-headroom} min acima · ${days}`, tone(false, true)]
            : ['Acima da capacidade', `${-headroom} min acima · ${days}`, tone(false, false)];
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 13 }} className="btg-mono">
      <span className="btg-mute">Planejado {planned}/{budget} min ({pct}%)</span>
      <span style={{ color }}>{label}{detail ? ` · ${detail}` : ''}</span>
    </span>
  );
}

// ---------- library picker ----------

type Mark = 'mastered' | 'carry' | 'stuck' | 'doubts' | 'fresh';
const MARK: Record<Exclude<Mark, 'mastered'>, { label: string | null; color: string }> = {
  fresh: { label: null, color: 'var(--btg-primary)' },
  carry: { label: 'Carry-over', color: 'var(--btg-secondary)' },
  doubts: { label: 'Teve dúvidas', color: 'var(--btg-doubts)' },
  stuck: { label: 'Travou', color: 'var(--btg-stuck)' },
};
type History = PlanContextResponse['memberHistory'][number]['lastOutcome'];

// Mastered = already finished, SKIPPED included (member skipped because they knew it). Hidden.
function markFor(id: string, carry: Set<string>, history: Map<string, History>): Mark {
  const last = history.get(id);
  if (last === 'DONE_EASY' || last === 'DONE_HARD' || last === 'SKIPPED') return 'mastered';
  if (carry.has(id)) return 'carry';
  if (last === 'STUCK') return 'stuck';
  if (last === 'DOUBTS') return 'doubts';
  return 'fresh';
}

const DIFF_RANK: Record<string, number> = { EASY: 0, MEDIUM: 1, HARD: 2 };

// Same order as the classic picker/library: topic order → per-topic manual order (the
// filtered topic's row when a filter is on) → difficulty → title.
function sortItems(items: AdminLibraryItem[], topicOrder: Record<string, number>, focused: string | null) {
  const row = (i: AdminLibraryItem) =>
    (focused && i.topics.find((t) => t.id === focused)) || i.topics.find((t) => t.isPrimary) || i.topics[0];
  return [...items].sort((a, b) => {
    const ra = row(a);
    const rb = row(b);
    const oa = ra ? topicOrder[ra.slug] ?? 999 : 999;
    const ob = rb ? topicOrder[rb.slug] ?? 999 : 999;
    if (oa !== ob) return oa - ob;
    const ma = ra?.order ?? null;
    const mb = rb?.order ?? null;
    if (ma !== mb) return ma === null ? 1 : mb === null ? -1 : ma - mb;
    return (DIFF_RANK[a.difficulty] ?? 9) - (DIFF_RANK[b.difficulty] ?? 9) || a.title.localeCompare(b.title);
  });
}

const FORMATS = [['VIDEO', 'Vídeo'], ['ARTICLE', 'Artigo'], ['BOOK', 'Livro'], ['PROBLEM', 'Problema']];

export function LibraryPicker({
  items,
  loading,
  topics,
  memberTrack,
  selected,
  carry,
  memberHistory,
  onAdd,
}: {
  items: AdminLibraryItem[] | undefined;
  loading: boolean;
  topics: Topic[];
  memberTrack: string | null;
  selected: Set<string>;
  carry: Set<string>;
  memberHistory: PlanContextResponse['memberHistory'];
  onAdd: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [topicId, setTopicId] = useState('');
  const [format, setFormat] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const history = useMemo(() => new Map(memberHistory.map((h) => [h.libraryItemId, h.lastOutcome])), [memberHistory]);
  const topicOrder = useMemo(() => Object.fromEntries(topics.map((t) => [t.slug, t.order])), [topics]);

  const filtered = useMemo(() => {
    let list = (items ?? []).filter((i) => markFor(i.id, carry, history) !== 'mastered');
    if (memberTrack) list = list.filter((i) => !i.tracks?.length || i.tracks.includes(memberTrack));
    if (topicId) list = list.filter((i) => i.topics.some((t) => t.id === topicId));
    if (format) list = list.filter((i) => i.format === format);
    if (difficulty) list = list.filter((i) => i.difficulty === difficulty);
    return query.trim().length >= 2 ? fuseFilter(list, query) : sortItems(list, topicOrder, topicId || null);
  }, [items, carry, history, memberTrack, topicId, format, difficulty, query, topicOrder]);

  const any = Boolean(query || topicId || format || difficulty);

  return (
    <section className="btg-card btg-card--pad" style={{ padding: 16, gap: 10 }}>
      <span style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="library_books" style={{ color: 'var(--btg-secondary)' }} />
        Acervo
        <span className="btg-mono btg-mute" style={{ fontSize: 12, marginLeft: 'auto' }}>{filtered.length} itens</span>
      </span>
      <label style={{ position: 'relative', display: 'block' }}>
        <Icon name="search" style={{ position: 'absolute', left: 10, top: 12, color: 'var(--btg-text-mute)' }} />
        <input
          className="btg-input"
          aria-label="Buscar no acervo"
          placeholder="Título, url, tópico…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ paddingLeft: 38 }}
        />
      </label>
      <select className="btg-select" aria-label="Tópico" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
        <option value="">Todos os tópicos</option>
        {[...topics].sort((a, b) => a.order - b.order).map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <select className="btg-select" aria-label="Formato" value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="">Formato</option>
          {FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="btg-select" aria-label="Dificuldade" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">Dificuldade</option>
          {Object.entries(DIFFICULTY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {any && (
        <button
          type="button"
          className="btg-btn btg-btn--ghost btg-btn--sm"
          style={{ alignSelf: 'flex-start', height: 28, padding: 0 }}
          onClick={() => {
            setQuery('');
            setTopicId('');
            setFormat('');
            setDifficulty('');
          }}
        >
          Limpar filtros
        </button>
      )}
      <div style={{ maxHeight: 440, overflowY: 'auto', marginRight: -8, paddingRight: 8 }}>
        {loading && <span className="btg-mute" style={{ fontSize: 13 }}>Carregando acervo…</span>}
        {!loading && filtered.length === 0 && <span className="btg-mute" style={{ fontSize: 13 }}>Nada encontrado. Tente uma busca mais curta.</span>}
        {filtered.map((l) => {
          const p = platformOf(l.url, l.format);
          const mark = markFor(l.id, carry, history) as Exclude<Mark, 'mastered'>;
          const has = selected.has(l.id);
          const primary = l.topics.find((t) => t.isPrimary) ?? l.topics[0];
          return (
            <div key={l.id} className="btg-lib-row">
              <span className="btg-stripe" style={{ background: p.color, height: 28 }} />
              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14 }}>{l.title}</span>
                <span className="btg-mute" style={{ fontSize: 12 }}>
                  {p.label}
                  {primary ? ` · ${primary.label}` : ''} · {DIFFICULTY[l.difficulty] ?? l.difficulty} · {l.estimatedMinutes} min
                </span>
                {!has && MARK[mark].label && (
                  <span className="btg-ac-tag" style={{ color: MARK[mark].color, alignSelf: 'flex-start', marginTop: 4 }}>{MARK[mark].label}</span>
                )}
              </div>
              <button
                type="button"
                className="btg-icon-btn"
                aria-label={has ? 'Já está no plano' : `Adicionar ${l.title} ao plano`}
                disabled={has}
                onClick={() => onAdd(l.id)}
                style={{ color: has ? 'var(--btg-done-easy)' : MARK[mark].color, width: 32, height: 32 }}
              >
                <Icon name={has ? 'check' : 'add'} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------- context (last week, carry-over, retro, coverage) ----------

const LAST_WEEK: Array<[keyof PlanContextResponse['lastWeek']['outcomes'], ItemOutcome]> = [
  ['done_easy', 'DONE_EASY'],
  ['done_hard', 'DONE_HARD'],
  ['doubts', 'DOUBTS'],
  ['stuck', 'STUCK'],
  ['skipped', 'SKIPPED'],
  ['pending', 'PENDING'],
];

export function ContextCard({
  context,
  showCarry,
  carryIds,
  onCarryChange,
  inPlan,
  onAdd,
}: {
  context: PlanContextResponse;
  showCarry: boolean;
  carryIds: string[];
  onCarryChange: (ids: string[]) => void;
  inPlan: Set<string>;
  onAdd: (libraryItemId: string) => void;
}) {
  const o = context.lastWeek.outcomes;
  const total = Object.values(o).reduce((s, n) => s + n, 0);
  const retro = context.retro;
  return (
    <section className="btg-card btg-card--pad" style={{ padding: 16, gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="btg-eyebrow">Semana anterior · {total} {total === 1 ? 'item' : 'itens'}</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
          {LAST_WEEK.map(([k, outcome]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, minWidth: 0 }}>
              <span className="btg-dot" style={{ background: OUTCOMES[outcome].color }} />
              <span className="btg-soft" style={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{OUTCOMES[outcome].label}</span>
              <span className="btg-mono" style={{ fontWeight: 600 }}>{o[k]}</span>
            </span>
          ))}
        </div>
      </div>

      {showCarry && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="btg-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="history" style={{ fontSize: 16 }} /> Ficou da semana anterior
          </span>
          {context.carryOverCandidates.length === 0 && <span className="btg-mute" style={{ fontSize: 13 }}>Nada pendente para carregar.</span>}
          {context.carryOverCandidates.length > 0 && (
            <span className="btg-mute" style={{ fontSize: 12 }}>Marcados entram no rascunho da IA.</span>
          )}
          {context.carryOverCandidates.map((c) => {
            const checked = carryIds.includes(c.id);
            const has = inPlan.has(c.libraryItemId);
            return (
              <div key={c.id} className="btg-candidate" style={{ alignItems: 'flex-start', padding: '8px 6px 8px 10px' }}>
                <input
                  type="checkbox"
                  aria-label={`Considerar ${c.title} no rascunho da IA`}
                  checked={checked}
                  onChange={() => onCarryChange(checked ? carryIds.filter((x) => x !== c.id) : [...carryIds, c.id])}
                  style={{ marginTop: 4, accentColor: 'var(--btg-primary)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="btg-dot" style={{ background: OUTCOMES[c.outcome].color }} />
                    {c.title}
                  </span>
                  {c.reflection && <span className="btg-soft" style={{ fontSize: 12, fontStyle: 'italic' }}>“{c.reflection}”</span>}
                  <span className="btg-mute" style={{ fontSize: 12 }}>
                    {c.topicLabel ? `${c.topicLabel} · ` : ''}{c.estimatedMinutes} min
                  </span>
                </div>
                <button
                  type="button"
                  className="btg-icon-btn"
                  aria-label={has ? 'Já está no plano' : 'Adicionar ao plano'}
                  disabled={has}
                  onClick={() => onAdd(c.libraryItemId)}
                  style={{ color: 'var(--btg-primary)', width: 32, height: 32 }}
                >
                  <Icon name={has ? 'check' : 'add'} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="btg-eyebrow">
          {retro ? `Retro · enviada em ${new Date(retro.submittedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}` : 'Retro'}
        </span>
        {!retro && <span className="btg-mute" style={{ fontSize: 13 }}>Sem retro na semana anterior.</span>}
        {retro &&
          (
            [
              ['O que fez sentido', retro.whatClicked, retro.valuedItem],
              ['Onde travou', retro.whatStuck, retro.stuckItem],
              ['Desejo para a próxima semana', retro.nextWeekWish, null],
            ] as const
          )
            .filter(([, text]) => text)
            .map(([label, text, item]) => (
              <div key={label} style={{ background: 'var(--btg-bg)', borderRadius: 4, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="btg-mute" style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                {item && <span className="btg-mute" style={{ fontSize: 12 }}>→ {item.title}</span>}
                <span className="btg-soft" style={{ fontSize: 13, lineHeight: '19px' }}>“{text}”</span>
              </div>
            ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="btg-eyebrow">Cobertura por tópico · histórico</span>
        {context.topicCoverage.length === 0 && <span className="btg-mute" style={{ fontSize: 13 }}>Nenhum tópico estudado ainda.</span>}
        {context.topicCoverage.map((t) => {
          const pct = Math.min(100, Math.round((t.itemsDone / Math.max(1, t.itemsAvailable)) * 100));
          return (
            <div key={t.topicId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span className="btg-soft">{t.topicLabel}</span>
                <span className="btg-mono btg-mute">{t.itemsDone}/{t.itemsAvailable}</span>
              </span>
              <div className="btg-track btg-track--thin"><div style={{ width: `${pct}%` }} /></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------- week grid ----------

const DAY_LABELS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;


export function WeekGrid({
  weekStart,
  availability,
  placements,
  busyBlocks,
  items,
  overflowIds,
  updating,
  stale,
  onItemClick,
}: {
  weekStart: string;
  availability: PlanContextResponse['availability'];
  placements: SchedulingPlacement[];
  busyBlocks: PreviewBusyBlock[];
  items: WeeklyPlanItem[];
  overflowIds: Set<string>;
  updating: boolean;
  stale: boolean;
  onItemClick: (libraryItemId: string) => void;
}) {
  const a = availability;
  const tz = a.timezone;
  const caps = [a.mondayMinutes, a.tuesdayMinutes, a.wednesdayMinutes, a.thursdayMinutes, a.fridayMinutes, a.saturdayMinutes, a.sundayMinutes];
  const start = new Date(`${weekStart.slice(0, 10)}T00:00:00`);
  const byLib = new Map(items.map((i) => [i.libraryItemId, i]));
  const dayOf = (iso: string) => Math.max(0, Math.min(6, Math.floor((new Date(iso).getTime() - start.getTime()) / 86_400_000)));
  const total = placements.reduce((s, p) => s + p.durationMinutes, 0);
  const now = Date.now();
  // Busy blocks bucketed by member-local day, like the classic week preview.
  const busyByDay = bucketBusyByLocalDay(busyBlocks, weekStart, tz);

  return (
    <section className="btg-card btg-card--pad" style={{ padding: '16px 20px', gap: 12 }}>
      <span style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Icon name="calendar_month" style={{ color: 'var(--btg-secondary)' }} />
        Agenda da semana
        <span className="btg-mono btg-mute" style={{ fontSize: 13 }}>total {minutesLabel(total)}</span>
        {updating && <span className="btg-mute" style={{ fontSize: 13 }}>atualizando…</span>}
        {stale && !updating && <span className="btg-mute" style={{ fontSize: 13 }}>prévia desatualizada</span>}
      </span>
      <div style={{ overflowX: 'auto' }}>
        <div className="btg-ac-week">
          {DAY_LABELS.map((label, d) => {
            const date = new Date(start);
            date.setDate(start.getDate() + d);
            const cap = caps[d] ?? 0;
            const slots = a.slots
              .filter((s) => s.dayOfWeek === d)
              .sort((x, y) => x.startMinute - y.startMinute)
              .map((s) => {
                const end = new Date(date);
                end.setHours(0, s.endMinute, 0, 0);
                return { ...s, past: end.getTime() <= now };
              });
            const busy = busyByDay[d] ?? [];
            const blocks = placements.filter((p) => dayOf(p.scheduledAt) === d).sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt));
            const future = slots.filter((s) => !s.past);
            const off = cap === 0;
            const closed = off || slots.length === 0 || future.length === 0;
            // Same rule as the classic day card (lib/scheduling/day-free.ts).
            const free = closed
              ? 0
              : computeDayFreeMinutes({
                  capMinutes: cap,
                  futureSlots: future,
                  busyBlocks: busy,
                  scheduledMinutes: blocks.reduce((s, p) => s + p.durationMinutes, 0),
                  itemCount: blocks.length,
                });
            const cls = ['btg-ac-day', closed ? 'btg-ac-day--off' : '', blocks.some((p) => overflowIds.has(p.itemId)) ? 'btg-ac-day--overflow' : ''].join(' ');
            return (
              <div key={label} className={cls}>
                <span style={{ fontSize: 14 }}>
                  {label} <span className="btg-mono btg-mute" style={{ fontSize: 12 }}>{date.getDate()}</span>
                </span>
                <span className="btg-mute">{off ? 'Folga' : `${cap} min`}</span>
                {!off && slots.length === 0 && <span className="btg-mute" style={{ fontStyle: 'italic' }}>sem janela</span>}
                {!off && slots.length > 0 && future.length === 0 && <span className="btg-mute" style={{ fontStyle: 'italic' }}>janelas passaram</span>}
                {!off &&
                  slots.map((s, k) => (
                    <span key={k} className="btg-mono btg-mute" style={{ textDecoration: s.past ? 'line-through' : undefined }}>
                      {hhmm(s.startMinute)}–{hhmm(s.endMinute)}
                    </span>
                  ))}
                {!off &&
                  busy.map((b, k) => (
                    <span key={`b${k}`} className="btg-mono" style={{ color: 'var(--btg-stuck)' }} title="Ocupado no Google Calendar">
                      ocupado {hhmm(b.startMinute)}–{hhmm(b.endMinute)}
                    </span>
                  ))}
                <hr />
                {blocks.length === 0 && <span className="btg-mute">—</span>}
                {blocks.map((p) => {
                  const it = byLib.get(p.itemId);
                  if (!it) return null;
                  const plat = platformOf(it.libraryItem.url, it.libraryItem.format);
                  return (
                    <button
                      key={`${p.itemId}-${p.scheduledAt}`}
                      type="button"
                      className="btg-ac-block"
                      style={{ borderLeftColor: plat.color }}
                      onClick={() => onItemClick(it.libraryItemId)}
                    >
                      <span className="btg-mono btg-mute" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="btg-dot" style={{ background: OUTCOMES[it.outcome].color, width: 6, height: 6 }} />
                        {new Date(p.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ lineHeight: '16px' }}>{it.libraryItem.title}</span>
                      <span className="btg-mute" style={{ fontSize: 11 }}>{plat.label} · {minutesLabel(p.durationMinutes)}</span>
                    </button>
                  );
                })}
                <hr />
                <span className="btg-mono" style={{ color: closed ? 'var(--btg-text-mute)' : free > 0 ? 'var(--btg-done-easy)' : 'var(--btg-text-mute)' }}>
                  {closed ? '—' : `livre ${free} min`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
