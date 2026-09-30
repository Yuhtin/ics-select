'use client';

import { useMemo, useState } from 'react';
import type { AiDraft, SchedulingPlacement, WeeklyPlanItem } from '../../lib/queries/admin-plan-editor';
import type { LibraryItem } from '../../lib/queries/library-search';
import { Icon, Modal, platformOf } from '../ui';

// ---------- timezone helpers (member tz, no Temporal polyfill needed) ----------

/** Offset of `tz` at `utcMs`, in ms (negative west of UTC). */
function tzOffset(utcMs: number, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(utcMs))
      .map((x) => [x.type, Number(x.value)]),
  );
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs;
}

/** "2026-10-05T07:00" read as wall-clock time in `tz` → UTC ISO. */
function zonedToIso(value: string, tz: string): string | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return new Date(naive - tzOffset(naive, tz)).toISOString();
}

const inTz = (iso: string, tz: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: tz, ...opts }).format(new Date(iso)).replace('.', '');

// ---------- publish ----------

export type PublishOptions = { publishAt: string | null; sendWhatsapp: boolean; autoSchedule: boolean };

export function PublishModal({
  open,
  onClose,
  weekStart,
  timezone,
  publishing,
  defaultSendWhatsapp,
  defaultAutoSchedule,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  /** Plan's first day; its UTC date is used (weekStart is UTC midnight Monday). */
  weekStart: string;
  timezone: string;
  publishing: boolean;
  defaultSendWhatsapp: boolean;
  defaultAutoSchedule: boolean;
  onSubmit: (o: PublishOptions) => void;
}) {
  const [mode, setMode] = useState<'scheduled' | 'now'>('scheduled');
  // Default: the plan's Monday at 07:00 member time.
  const [when, setWhen] = useState(`${weekStart.slice(0, 10)}T07:00`);
  const [sendWhatsapp, setSendWhatsapp] = useState(defaultSendWhatsapp);
  const [autoSchedule, setAutoSchedule] = useState(defaultAutoSchedule);
  const iso = mode === 'scheduled' ? zonedToIso(when, timezone) : null;
  const label = iso ? `${inTz(iso, timezone, { weekday: 'short', day: 'numeric', month: 'short' })} · ${inTz(iso, timezone, { hour: '2-digit', minute: '2-digit' })}` : '—';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Publicar plano"
      width={520}
      footer={
        <>
          <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={onClose} disabled={publishing}>Cancelar</button>
          <button
            type="button"
            className="btg-btn btg-btn--primary btg-btn--sm"
            disabled={publishing || (mode === 'scheduled' && !iso)}
            onClick={() => onSubmit({ publishAt: mode === 'now' ? null : iso, sendWhatsapp, autoSchedule })}
          >
            <Icon name={mode === 'now' ? 'publish' : 'schedule_send'} />
            {publishing ? 'Publicando…' : mode === 'now' ? 'Publicar agora' : 'Agendar publicação'}
          </button>
        </>
      }
    >
      <span className="btg-mono btg-mute" style={{ fontSize: 12 }}>Fuso do membro · {timezone}</span>
      <span className="btg-eyebrow">Quando</span>
      <span className="btg-ac-seg" role="group" aria-label="Quando publicar" style={{ alignSelf: 'flex-start' }}>
        <button type="button" aria-pressed={mode === 'scheduled'} onClick={() => setMode('scheduled')} style={{ height: 40, padding: '0 16px' }}>Agendado</button>
        <button type="button" aria-pressed={mode === 'now'} onClick={() => setMode('now')} style={{ height: 40, padding: '0 16px' }}>Publicar agora</button>
      </span>
      {mode === 'scheduled' && (
        <label className="btg-field">
          Data e hora (horário do membro)
          <input type="datetime-local" className="btg-input btg-mono" value={when} onChange={(e) => setWhen(e.target.value)} />
          <span className="btg-mute" style={{ fontSize: 12 }}>Publica em <strong>{label}</strong>.</span>
        </label>
      )}
      <label className="btg-ac-check">
        <input type="checkbox" checked={autoSchedule} onChange={(e) => setAutoSchedule(e.target.checked)} />
        Criar eventos no Google Calendar
      </label>
      <label className="btg-ac-check">
        <input type="checkbox" checked={sendWhatsapp} onChange={(e) => setSendWhatsapp(e.target.checked)} />
        Avisar o membro pelo WhatsApp
      </label>
    </Modal>
  );
}

// ---------- scheduling result ----------

export type SchedulingPhase = 'pending' | 'done' | 'overflow';

export function SchedulingModal({
  open,
  phase,
  flow,
  items,
  placements,
  overflow,
  timezone,
  sessionsFailed,
  pendingForce,
  onClose,
  onForce,
}: {
  open: boolean;
  phase: SchedulingPhase;
  flow: 'publish' | 'edit';
  items: WeeklyPlanItem[];
  placements: SchedulingPlacement[];
  overflow: Array<{ itemId: string; minutesRequired: number }>;
  timezone: string;
  sessionsFailed: number;
  pendingForce: boolean;
  onClose: () => void;
  onForce: () => void;
}) {
  const byItem = new Map(placements.map((p) => [p.itemId, p]));
  const over = new Map(overflow.map((o) => [o.itemId, o]));
  const fmt = (iso: string, min: number) =>
    `${inTz(iso, timezone, { weekday: 'short', day: 'numeric', month: 'short' })} · ${inTz(iso, timezone, { hour: '2-digit', minute: '2-digit' })} · ${min} min`;
  const title =
    phase === 'pending'
      ? 'Calculando e alocando…'
      : phase === 'overflow'
        ? `${overflow.length} ${overflow.length === 1 ? 'item não coube' : 'itens não couberam'}`
        : flow === 'edit'
          ? 'Alterações aplicadas'
          : 'Plano publicado';

  return (
    // key remounts the dialog per phase, so an Esc press while pending can't leave it closed for good.
    <Modal
      key={phase}
      open={open}
      onClose={() => phase !== 'pending' && onClose()}
      title={title}
      width={640}
      footer={
        phase === 'pending' ? (
          <span className="btg-mute" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="progress_activity" /> Criando eventos no Google Calendar…
          </span>
        ) : phase === 'overflow' ? (
          <>
            <span className="btg-ac-danger" style={{ fontSize: 13, marginRight: 'auto', alignSelf: 'center' }}>Forçar ignora a disponibilidade declarada.</span>
            <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={onClose} disabled={pendingForce}>Ajustar plano</button>
            <button type="button" className="btg-btn btg-btn--primary btg-btn--sm" style={{ background: 'var(--btg-stuck)' }} onClick={onForce} disabled={pendingForce}>
              {pendingForce ? 'Forçando…' : 'Forçar publicação'}
            </button>
          </>
        ) : (
          <>
            <span className="btg-mono" style={{ fontSize: 13, marginRight: 'auto', alignSelf: 'center', color: sessionsFailed > 0 ? 'var(--btg-done-hard)' : 'var(--btg-done-easy)' }}>
              {sessionsFailed > 0
                ? `${sessionsFailed} ${sessionsFailed === 1 ? 'falha' : 'falhas'} no Calendar`
                : `${placements.length} ${placements.length === 1 ? 'sessão' : 'sessões'} no Calendar`}
            </span>
            <button type="button" className="btg-btn btg-btn--primary btg-btn--sm" onClick={onClose}>Concluir</button>
          </>
        )
      }
    >
      <span className="btg-mono btg-mute" style={{ fontSize: 12 }}>
        {items.length} {items.length === 1 ? 'item' : 'itens'} · fuso {timezone}
        {phase === 'overflow' && ` · ${overflow.reduce((s, o) => s + o.minutesRequired, 0)} min sem janela`}
      </span>
      <div>
        {items.map((it, i) => {
          const p = byItem.get(it.id);
          const o = over.get(it.id);
          const [icon, color, text] =
            phase === 'pending'
              ? ['more_horiz', 'var(--btg-text-mute)', 'alocando…']
              : o
                ? ['event_busy', 'var(--btg-stuck)', `Não coube · faltam ${o.minutesRequired} min`]
                : p
                  ? ['event_available', 'var(--btg-done-easy)', fmt(p.scheduledAt, p.durationMinutes)]
                  : it.scheduledAt
                    ? ['event', 'var(--btg-text-mute)', `mantido · ${fmt(it.scheduledAt, it.scheduledMinutes ?? 0)}`]
                    : ['remove', 'var(--btg-text-mute)', 'sem horário'];
          return (
            <div key={it.id} className="btg-lib-row">
              <span className="btg-mono btg-mute" style={{ width: 24, textAlign: 'right', fontSize: 13 }}>{i + 1}.</span>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 14 }}>{it.libraryItem.title}</span>
                <span className="btg-mono" style={{ fontSize: 12, color, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name={icon} style={{ fontSize: 16 }} />
                  {text}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ---------- AI draft ----------

export function AiDraftModal({
  open,
  onClose,
  draft,
  libById,
  topicName,
  carry,
  added,
  loading,
  onGenerate,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  draft: AiDraft | null;
  libById: Map<string, LibraryItem>;
  topicName: (topicId: string | null) => string | null;
  carry: Set<string>;
  added: Set<string>;
  loading: boolean;
  onGenerate: (brief?: string) => void;
  onAdd: (ids: string[]) => void;
}) {
  const [brief, setBrief] = useState('');
  const suggested = useMemo(
    () => (draft?.items ?? []).filter((i) => !added.has(i.libraryItemId)).sort((a, b) => a.order - b.order),
    [draft, added],
  );
  const alternates = (draft?.alternates ?? []).filter((a) => !added.has(a.libraryItemId));
  const generate = () => onGenerate(brief.trim() || undefined);
  const briefField = (
    <label className="btg-field">
      Direção (opcional)
      <textarea
        className="btg-textarea"
        rows={3}
        maxLength={200}
        value={brief}
        onChange={(e) => setBrief(e.target.value.slice(0, 200))}
        placeholder="Ex.: quero todos os vídeos de foundations."
      />
      <span className="btg-mono btg-mute" style={{ fontSize: 12, textAlign: 'right' }}>{brief.length}/200</span>
    </label>
  );

  return (
    <Modal open={open} onClose={onClose} title="Sugestão da IA" width={680}>
      {loading ? (
        <p className="btg-eyebrow" style={{ padding: '32px 0', textAlign: 'center' }}>Gerando… leva de 10 a 20 s</p>
      ) : !draft ? (
        <>
          <p className="btg-soft" style={{ fontSize: 15, lineHeight: '22px' }}>
            A IA considera as últimas 4 semanas, a retro, a cobertura por tópico, os itens de carry-over marcados e a trilha do membro.
          </p>
          {briefField}
          <button type="button" className="btg-btn btg-btn--primary" style={{ alignSelf: 'flex-start' }} onClick={generate}>
            <Icon name="auto_awesome" />
            Gerar sugestão
          </button>
        </>
      ) : (
        <>
          <section className="btg-card btg-card--ai">
            <span className="btg-ai-label"><Icon name="auto_awesome" />Racional</span>
            <span className="btg-soft" style={{ fontSize: 14, lineHeight: '22px' }}>{draft.narrative}</span>
            <span className="btg-mono btg-mute" style={{ fontSize: 12 }}>{draft.items.length} itens · {draft.totalMinutes} min</span>
          </section>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 14, color: 'var(--btg-primary)', fontWeight: 600 }}>Gerar de novo com outra direção</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              {briefField}
              <button type="button" className="btg-btn btg-btn--outline btg-btn--sm" style={{ alignSelf: 'flex-start' }} onClick={generate}>
                <Icon name="refresh" />
                Gerar de novo
              </button>
            </div>
          </details>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span className="btg-eyebrow">Sugeridos · {suggested.length}</span>
            {suggested.length > 1 && (
              <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={() => onAdd(suggested.map((s) => s.libraryItemId))}>
                Adicionar todos
              </button>
            )}
          </div>
          {suggested.length === 0 && <span className="btg-mute" style={{ fontSize: 14 }}>Todas as sugestões já estão no plano.</span>}
          {suggested.map((s, idx) => {
            const l = libById.get(s.libraryItemId);
            if (!l) return null;
            const p = platformOf(l.url, l.format);
            const topic = topicName(l.topicId);
            return (
              <div key={s.libraryItemId} className="btg-candidate" style={{ alignItems: 'flex-start', padding: 12, gap: 12 }}>
                <span className="btg-mono btg-mute" style={{ fontSize: 14 }}>{idx + 1}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1, minWidth: 0 }}>
                  {carry.has(s.libraryItemId) && <span className="btg-ac-tag" style={{ color: 'var(--btg-secondary)', alignSelf: 'flex-start' }}>Carry-over</span>}
                  <span style={{ fontSize: 15 }}>{l.title}</span>
                  <span className="btg-mute" style={{ fontSize: 12 }}>
                    {p.label}{topic ? ` · ${topic}` : ''} · {l.estimatedMinutes} min
                  </span>
                  <span className="btg-soft" style={{ fontSize: 13, lineHeight: '19px', background: 'var(--btg-blue-50)', borderRadius: 4, padding: '6px 10px' }}>
                    <strong style={{ color: 'var(--btg-secondary)' }}>Por quê: </strong>
                    {s.rationale}
                  </span>
                </div>
                <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={() => onAdd([s.libraryItemId])}>
                  Adicionar
                </button>
              </div>
            );
          })}

          {alternates.length > 0 && (
            <details>
              <summary style={{ cursor: 'pointer' }} className="btg-eyebrow">Alternativas · {alternates.length}</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {alternates.map((alt) => {
                  const l = libById.get(alt.libraryItemId);
                  if (!l) return null;
                  return (
                    <div key={alt.libraryItemId} className="btg-candidate" style={{ padding: '8px 8px 8px 12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 14 }}>{l.title}</span>
                        <span className="btg-mute" style={{ fontSize: 12 }}>{alt.rationale}</span>
                      </div>
                      <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={() => onAdd([alt.libraryItemId])}>
                        Adicionar
                      </button>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </>
      )}
    </Modal>
  );
}
