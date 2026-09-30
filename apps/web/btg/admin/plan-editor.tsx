'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { allocatedMinutes, sumAllocatedMinutes } from '@ics-select/shared';
import { apiFetch, ApiErrorResponse } from '../../lib/api/client';
import {
  useAutoSchedulePlan,
  useDeletePlan,
  useDraftAiPlan,
  useEditPublishedPlan,
  useGetOrCreateDraft,
  usePlan,
  usePublishPlan,
  useReschedulePending,
  useUpdatePlan,
  type AiDraft,
  type SchedulingPlacement,
  type WeeklyPlan,
  type WeeklyPlanItem,
} from '../../lib/queries/admin-plan-editor';
import { useAdminPlanContext } from '../../lib/queries/admin-plan-context';
import { useReorganizeForFit, useSchedulingPreview, type PreviewItem } from '../../lib/queries/admin-plan-preview';
import { useAdminLibrary } from '../../lib/queries/admin-library';
import { useTopics } from '../../lib/queries/admin-topics';
import type { LibraryItem } from '../../lib/queries/library-search';
import { DIFFICULTY, Icon, Loading, OUTCOMES, platformOf } from '../ui';
import { BudgetLine, ContextCard, LibraryPicker, WeekGrid } from './cycles-plan-parts';
import { AiDraftModal, PublishModal, SchedulingModal, type PublishOptions, type SchedulingPhase } from './cycles-plan-modals';
import { Confirm, Notice, PLAN_STATUS, TRACKS, shortDate, ymdLocal } from './cycles-ui';
import { BTG_ADMIN_BASE } from './shell';

type Overflow = Array<{ itemId: string; minutesRequired: number }>;
type Scheduling = {
  open: boolean;
  phase: SchedulingPhase;
  /** publish navigates away on "Concluir"; edit stays on the page. */
  flow: 'publish' | 'edit';
  items: WeeklyPlanItem[];
  placements: SchedulingPlacement[];
  overflow: Overflow;
  sessionsFailed: number;
};
const CLOSED: Scheduling = { open: false, phase: 'pending', flow: 'publish', items: [], placements: [], overflow: [], sessionsFailed: 0 };
type Toast = { kind: 'ok' | 'bad' | 'warn'; title: string; text?: string } | null;

const errText = (err: unknown) => (err instanceof Error ? err.message : 'Erro desconhecido');
function overflowOf(err: unknown): Overflow | null {
  if (!(err instanceof ApiErrorResponse) || err.apiError?.code !== 'PLAN_OVERFLOW') return null;
  return (err.apiError.details as { overflow?: Overflow } | undefined)?.overflow ?? [];
}
const reorder = (items: WeeklyPlanItem[]) => items.map((i, order) => ({ ...i, order }));
const itemsPayload = (p: WeeklyPlan) => p.items.map((i) => ({ libraryItemId: i.libraryItemId, order: i.order }));

function Editor({ memberId, serverPlan }: { memberId: string; serverPlan: WeeklyPlan }) {
  const router = useRouter();
  const [plan, setPlan] = useState(serverPlan);
  const [dirty, setDirty] = useState(false);
  // Server refetches (publish, reschedule, save) flow in unless there are unsaved local edits.
  useEffect(() => {
    if (!dirty) setPlan(serverPlan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverPlan]);

  const { data: context } = useAdminPlanContext(memberId, plan.weekStart);
  const { data: topics } = useTopics();
  const library = useAdminLibrary();
  const [extraLibs, setExtraLibs] = useState<Map<string, LibraryItem>>(new Map());
  const libById = useMemo(() => {
    const m = new Map<string, LibraryItem>(extraLibs);
    for (const l of library.data ?? []) m.set(l.id, l);
    return m;
  }, [library.data, extraLibs]);
  const topicName = useCallback(
    (id: string | null) => (id ? topics?.find((t) => t.id === id)?.label ?? null : null),
    [topics],
  );

  const [carryIds, setCarryIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (context && carryIds === null) setCarryIds(context.carryOverCandidates.map((c) => c.id));
  }, [context, carryIds]);
  const carryLibIds = useMemo(
    () => new Set((context?.carryOverCandidates ?? []).filter((c) => carryIds?.includes(c.id)).map((c) => c.libraryItemId)),
    [context, carryIds],
  );

  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [scheduling, setScheduling] = useState<Scheduling>(CLOSED);
  const [confirm, setConfirm] = useState<'reschedule' | 'delete' | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const draftAi = useDraftAiPlan();
  const updatePlan = useUpdatePlan();
  const publishPlan = usePublishPlan();
  const autoSchedule = useAutoSchedulePlan();
  const deletePlan = useDeletePlan();
  const editPublished = useEditPublishedPlan();
  const reschedulePending = useReschedulePending();
  const reorganize = useReorganizeForFit();

  const isDraft = plan.status === 'DRAFT';
  const isPublished = plan.status === 'PUBLISHED';
  const canEdit = isDraft || isPublished || plan.status === 'SCHEDULED';
  const inPlan = useMemo(() => new Set(plan.items.map((i) => i.libraryItemId)), [plan.items]);

  // ----- scheduling preview (drafts, or published plans whose auto-schedule never placed anything) -----
  const previewItems: PreviewItem[] = useMemo(
    () =>
      plan.items.map((i) => ({
        libraryItemId: i.libraryItemId,
        order: i.order,
        // Same minutes publish will request: VIDEO doubles in allocatedMinutes.
        estimatedMinutes: allocatedMinutes(i.libraryItem.estimatedMinutes, i.libraryItem.format),
      })),
    [plan.items],
  );
  const persisted = useMemo<SchedulingPlacement[]>(
    () =>
      plan.items
        .filter((i) => i.scheduledAt && i.scheduledMinutes)
        .map((i) => ({ itemId: i.libraryItemId, scheduledAt: i.scheduledAt!, durationMinutes: i.scheduledMinutes! })),
    [plan.items],
  );
  const hasPersisted = persisted.length > 0;
  const preview = useSchedulingPreview(
    plan.id,
    previewItems,
    previewItems.length > 0 && Boolean(context?.availability) && !hasPersisted,
    context?.availability?.busyBlocks,
  );
  const placements = hasPersisted ? persisted : preview.data?.placements ?? [];
  // Persisted state: any PENDING item without a slot is effectively overflow.
  const overflow: Overflow = hasPersisted
    ? plan.items
        .filter((i) => i.outcome === 'PENDING' && !i.scheduledAt)
        .map((i) => ({ itemId: i.libraryItemId, minutesRequired: allocatedMinutes(i.libraryItem.estimatedMinutes, i.libraryItem.format) }))
    : preview.data?.overflow ?? [];
  const overflowIds = new Set(overflow.map((o) => o.itemId));

  // ----- budget -----
  const minutesOf = (items: WeeklyPlanItem[]) =>
    sumAllocatedMinutes(items.map((i) => ({ estimatedMinutes: i.libraryItem.estimatedMinutes, format: i.libraryItem.format, outcome: i.outcome })));
  const planned = minutesOf(plan.items);
  const raw = plan.items.filter((i) => i.outcome !== 'SKIPPED').reduce((s, i) => s + i.libraryItem.estimatedMinutes, 0);
  const pendingMinutes = minutesOf(plan.items.filter((i) => i.outcome === 'PENDING' || i.outcome === 'STUCK'));

  // ----- local edits -----
  const setItems = (items: WeeklyPlanItem[]) => {
    setPlan((p) => ({ ...p, items: reorder(items) }));
    setDirty(true);
  };
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= plan.items.length) return;
    const next = [...plan.items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    setItems(next);
  };

  async function fetchLibs(ids: string[]) {
    const missing = [...new Set(ids)].filter((id) => !libById.has(id));
    if (missing.length === 0) return new Map<string, LibraryItem>();
    const found = (await Promise.all(missing.map((id) => apiFetch<LibraryItem>(`/library/${id}`).catch(() => null)))).filter(
      (l): l is LibraryItem => l !== null,
    );
    const got = new Map(found.map((l) => [l.id, l]));
    setExtraLibs((prev) => new Map([...prev, ...got]));
    return got;
  }

  async function addItems(ids: string[]) {
    const fetched = await fetchLibs(ids);
    const toAdd: WeeklyPlanItem[] = [];
    for (const id of ids) {
      if (inPlan.has(id) || toAdd.some((i) => i.libraryItemId === id)) continue;
      const l = libById.get(id) ?? fetched.get(id);
      if (!l) continue;
      toAdd.push({
        id: `local-${crypto.randomUUID()}`,
        libraryItemId: l.id,
        order: 0,
        outcome: 'PENDING',
        skippable: (l.topics ?? []).some((t) => t.slug === 'foundations'),
        scheduledAt: null,
        scheduledMinutes: null,
        libraryItem: { id: l.id, title: l.title, estimatedMinutes: l.estimatedMinutes, format: l.format, url: l.url, topicId: l.topicId, tags: l.tags, tracks: l.tracks },
      });
    }
    if (toAdd.length > 0) setItems([...plan.items, ...toAdd]);
  }

  function highlight(libId: string) {
    document.getElementById(`btg-plan-item-${libId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlash(libId);
    setTimeout(() => setFlash((f) => (f === libId ? null : f)), 2000);
  }

  // ----- actions -----
  const cyclePath = context ? `${BTG_ADMIN_BASE}/cycle/${context.cycle.id}` : `${BTG_ADMIN_BASE}/member/${memberId}`;

  async function generateDraft(briefText?: string) {
    try {
      const res = await draftAi.mutateAsync({
        memberId,
        weekStart: plan.weekStart,
        weekEnd: plan.weekEnd,
        carryOverItemIds: carryIds ?? [],
        briefText,
      });
      setAiDraft(res.draft);
      await fetchLibs([...res.draft.items, ...res.draft.alternates].map((i) => i.libraryItemId));
    } catch (err) {
      setToast({ kind: 'bad', title: 'A IA não conseguiu gerar o rascunho', text: errText(err) });
    }
  }

  async function save() {
    try {
      const saved = await updatePlan.mutateAsync({ planId: plan.id, adminNotes: plan.adminNotes ?? undefined, items: itemsPayload(plan) });
      setPlan(saved);
      setDirty(false);
      setToast({ kind: 'ok', title: 'Rascunho salvo.' });
    } catch (err) {
      setToast({ kind: 'bad', title: 'Não foi possível salvar', text: errText(err) });
    }
  }

  async function publish(opts: PublishOptions) {
    setPublishOpen(false);
    setToast(null);
    try {
      const saved = await updatePlan.mutateAsync({ planId: plan.id, adminNotes: plan.adminNotes ?? undefined, items: itemsPayload(plan) });
      setPlan(saved);
      setDirty(false);
      const res = await publishPlan.mutateAsync({ planId: plan.id, ...opts });
      // Reflect PUBLISHED/SCHEDULED now, so an overflow below doesn't leave Save/Publish buttons that 409.
      setPlan((p) => ({ ...p, status: res.plan.status }));
      if (res.deferred) {
        // Deferred publish: a cron runs auto-schedule + WhatsApp at publishAt.
        router.push(cyclePath);
        return;
      }
      if (!opts.autoSchedule) {
        router.push(cyclePath);
        return;
      }
      setScheduling({ ...CLOSED, open: true, items: saved.items.filter((i) => i.outcome !== 'SKIPPED') });
      try {
        const r = await autoSchedule.mutateAsync({ planId: plan.id, force: false });
        setScheduling((s) => ({ ...s, phase: 'done', placements: r.placements, overflow: r.overflow, sessionsFailed: r.sessionsFailed }));
      } catch (err) {
        const o = overflowOf(err);
        if (o) return setScheduling((s) => ({ ...s, phase: 'overflow', overflow: o }));
        setScheduling(CLOSED);
        setToast({ kind: 'bad', title: 'Falha ao agendar', text: errText(err) });
      }
    } catch (err) {
      setToast({ kind: 'bad', title: 'Falha ao publicar', text: errText(err) });
    }
  }

  async function applyEdit(force = false) {
    setToast(null);
    setScheduling({ ...CLOSED, open: true, flow: 'edit', items: plan.items.slice() });
    try {
      const res = await editPublished.mutateAsync({ planId: plan.id, adminNotes: plan.adminNotes ?? undefined, items: itemsPayload(plan), force });
      setPlan(res.plan);
      setDirty(false);
      setScheduling((s) => ({
        ...s,
        phase: 'done',
        items: res.plan.items.filter((i) => i.outcome !== 'SKIPPED'),
        placements: res.scheduling.placements,
        overflow: res.scheduling.overflow,
        sessionsFailed: res.scheduling.sessionsFailed,
      }));
    } catch (err) {
      const o = overflowOf(err);
      if (o) return setScheduling((s) => ({ ...s, phase: 'overflow', overflow: o }));
      setScheduling(CLOSED);
      const locked = err instanceof ApiErrorResponse && err.apiError?.code === 'CANT_REMOVE_COMPLETED_ITEM';
      setToast(
        locked
          ? { kind: 'bad', title: 'Itens com progresso não podem sair do plano', text: 'O que o membro já marcou fica no histórico.' }
          : { kind: 'bad', title: 'Não foi possível aplicar', text: errText(err) },
      );
    }
  }

  async function forceFromModal() {
    if (scheduling.flow === 'edit') return applyEdit(true);
    setScheduling((s) => ({ ...s, phase: 'pending', placements: [], overflow: [] }));
    try {
      const r = await autoSchedule.mutateAsync({ planId: plan.id, force: true });
      setScheduling((s) => ({ ...s, phase: 'done', placements: r.placements, overflow: r.overflow, sessionsFailed: r.sessionsFailed }));
    } catch (err) {
      setScheduling(CLOSED);
      setToast({ kind: 'bad', title: 'Falha ao publicar', text: errText(err) });
    }
  }

  function closeScheduling() {
    const leave = scheduling.flow === 'publish' && scheduling.phase === 'done';
    setScheduling(CLOSED);
    if (leave) router.push(cyclePath);
  }

  async function rescheduleNow(relaxOrder: boolean) {
    const count = plan.items.filter((i) => i.outcome === 'PENDING').length;
    if (relaxOrder && count === 0) {
      setToast({ kind: 'warn', title: 'Nada para reorganizar', text: 'Só itens pendentes são realocados; todos já têm resultado.' });
      return;
    }
    try {
      await reschedulePending.mutateAsync({ planId: plan.id, relaxOrder });
      setToast({
        kind: 'ok',
        title: relaxOrder ? 'Reorganizado: itens pendentes realocados' : 'Itens pendentes realocados',
        text: `${count} ${count === 1 ? 'item redistribuído' : 'itens redistribuídos'} no calendário. Itens já marcados não mudam.`,
      });
    } catch (err) {
      const o = overflowOf(err);
      setToast(
        o
          ? { kind: 'warn', title: 'Ainda sobra item sem janela', text: `${o.length} ${o.length === 1 ? 'item continua' : 'itens continuam'} sem horário. Aumente a disponibilidade ou tire itens.` }
          : { kind: 'bad', title: 'Não foi possível realocar', text: errText(err) },
      );
    }
  }

  async function reorganizeForFit() {
    if (isPublished) return rescheduleNow(true);
    try {
      const res = await reorganize.mutateAsync({ planId: plan.id, items: previewItems });
      // Placed items by earliest slot, then whatever still overflows.
      const first = new Map<string, string>();
      for (const p of res.placements) if (!first.has(p.itemId) || p.scheduledAt < first.get(p.itemId)!) first.set(p.itemId, p.scheduledAt);
      const placed = plan.items.filter((i) => first.has(i.libraryItemId)).sort((a, b) => first.get(a.libraryItemId)!.localeCompare(first.get(b.libraryItemId)!));
      const rest = plan.items.filter((i) => !first.has(i.libraryItemId));
      setItems([...placed, ...rest]);
      setToast({
        kind: res.overflow.length === 0 ? 'ok' : 'warn',
        title: `Reorganizado · ${first.size}/${previewItems.length} couberam${res.overflow.length ? ` · ${res.overflow.length} ainda fora` : ''}`,
        text: 'A ordem pedagógica foi relaxada. Salve o rascunho para manter.',
      });
    } catch (err) {
      setToast({ kind: 'bad', title: 'Não foi possível reorganizar', text: errText(err) });
    }
  }

  async function remove() {
    try {
      await deletePlan.mutateAsync(plan.id);
      router.push(`${BTG_ADMIN_BASE}/member/${memberId}`);
    } catch (err) {
      setConfirm(null);
      setToast({ kind: 'bad', title: 'Não foi possível apagar', text: errText(err) });
    }
  }

  // ----- week picker: current or next week, like the classic "Plan week" modal -----
  const thisMonday = new Date();
  thisMonday.setHours(0, 0, 0, 0);
  thisMonday.setDate(thisMonday.getDate() - ((thisMonday.getDay() + 6) % 7));
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(thisMonday.getDate() + 7);
  const weeks = [
    { value: ymdLocal(thisMonday), label: `Semana atual · ${shortDate(ymdLocal(thisMonday))}` },
    { value: ymdLocal(nextMonday), label: `Próxima semana · ${shortDate(ymdLocal(nextMonday))}` },
  ];
  const planWeek = plan.weekStart.slice(0, 10);
  if (!weeks.some((w) => w.value === planWeek)) weeks.unshift({ value: planWeek, label: `Semana de ${shortDate(planWeek)}` });

  const busy = updatePlan.isPending || publishPlan.isPending || autoSchedule.isPending || editPublished.isPending;
  const member = context?.member;

  return (
    <>
      <header className="btg-admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <Link href={cyclePath} aria-label="Voltar" className="btg-icon-btn" style={{ border: '1px solid var(--btg-border)' }}>
            <Icon name="arrow_back" />
          </Link>
          <div className="btg-admin-header-title">
            <span>
              {member ? `${member.name}${member.track ? ` · ${TRACKS[member.track] ?? member.track}` : ''}` : 'Plano semanal'}
              {context ? ` · semana ${context.cycle.weekNumber} de ${context.cycle.weeksTotal}` : ''}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              Plano de {shortDate(planWeek)} a {shortDate(plan.weekEnd.slice(0, 10))}
              <span className={isDraft ? 'btg-pill btg-pill--neutral' : 'btg-pill'}>{PLAN_STATUS[plan.status] ?? plan.status}</span>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="btg-select"
            aria-label="Semana do plano"
            style={{ height: 40 }}
            value={planWeek}
            onChange={(e) => e.target.value !== planWeek && router.push(`${BTG_ADMIN_BASE}/member/${memberId}/plan/new?weekStart=${e.target.value}`)}
          >
            {weeks.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
          {isDraft && (
            <button type="button" className="btg-btn btg-btn--outline btg-btn--sm" onClick={() => setAiOpen(true)} disabled={!context}>
              <Icon name="auto_awesome" />
              Sugerir com IA
            </button>
          )}
          {isPublished && (
            <button type="button" className="btg-btn btg-btn--outline btg-btn--sm" onClick={() => setConfirm('reschedule')} disabled={reschedulePending.isPending}>
              <Icon name="event_repeat" />
              {reschedulePending.isPending ? 'Realocando…' : 'Realocar pendentes'}
            </button>
          )}
          <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm btg-ac-danger" onClick={() => setConfirm('delete')} disabled={deletePlan.isPending}>
            <Icon name="delete" />
            Apagar
          </button>
        </div>
      </header>

      {!context ? (
        <Loading label="Carregando contexto do membro…" />
      ) : (
        <main className="btg-admin-main btg-admin-main--editor">
          <div className="btg-stack btg-ac-editor-side" style={{ gap: 16 }}>
            {canEdit && (
              <LibraryPicker
                items={library.data}
                loading={library.isLoading}
                topics={topics ?? []}
                memberTrack={context.member.track}
                selected={inPlan}
                carry={carryLibIds}
                memberHistory={context.memberHistory}
                onAdd={(id) => void addItems([id])}
              />
            )}
            <ContextCard
              context={context}
              showCarry={isDraft}
              carryIds={carryIds ?? []}
              onCarryChange={setCarryIds}
              inPlan={inPlan}
              onAdd={(id) => void addItems([id])}
            />
          </div>

          <div className="btg-stack" style={{ gap: 16 }}>
            {toast && (
              <Notice kind={toast.kind}>
                <strong style={{ fontWeight: 600 }}>{toast.title}</strong>
                {toast.text && <span>{toast.text}</span>}
              </Notice>
            )}
            {isPublished && (
              <Notice kind="warn">
                <strong style={{ fontWeight: 600 }}>Você está editando um plano publicado</strong>
                <span>As mudanças vão direto para o Google Calendar do membro. Itens com resultado não podem sair e nenhum WhatsApp é enviado.</span>
              </Notice>
            )}
            {plan.status === 'SCHEDULED' && plan.publishAt && (
              <Notice kind="ok">
                <strong style={{ fontWeight: 600 }}>
                  Publicação agendada para {new Date(plan.publishAt).toLocaleString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </strong>
                <span>Ajuste e salve até lá, ou publique agora.</span>
              </Notice>
            )}

            {aiDraft && (
              <section className="btg-card btg-card--ai" style={{ flexDirection: 'row', gap: 12, padding: '16px 20px', alignItems: 'flex-start' }}>
                <Icon name="auto_awesome" style={{ color: 'var(--btg-secondary)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1 }}>
                  <span className="btg-ai-label">Racional da IA</span>
                  <span className="btg-soft" style={{ fontSize: 14, lineHeight: '22px' }}>{aiDraft.narrative}</span>
                </div>
                <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={() => setAiOpen(true)}>Ver sugestões</button>
              </section>
            )}

            <section className="btg-card">
              <div className="btg-card-head" style={{ padding: '14px 20px', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 17 }}>Itens em ordem</span>
                  <span className="btg-mono btg-mute" style={{ fontSize: 13 }}>
                    {plan.items.length} {plan.items.length === 1 ? 'item' : 'itens'} · {planned} min ({raw} brutos)
                  </span>
                </span>
                <BudgetLine
                  planned={planned}
                  budget={context.availability?.weeklyBudgetMinutes ?? 0}
                  remaining={context.availability?.remainingCapacityMinutes ?? null}
                  pending={pendingMinutes}
                  daysRemaining={context.availability?.daysRemaining ?? 0}
                />
              </div>
              {plan.items.length === 0 && <p className="btg-empty">Adicione itens do acervo ou peça uma sugestão à IA.</p>}
              {plan.items.map((it, i) => {
                const p = platformOf(it.libraryItem.url, it.libraryItem.format);
                const lib = libById.get(it.libraryItemId);
                const topic = topicName(it.libraryItem.topicId);
                const locked = it.outcome !== 'PENDING';
                return (
                  <div
                    key={it.id}
                    id={`btg-plan-item-${it.libraryItemId}`}
                    className={flash === it.libraryItemId ? 'btg-ac-item btg-ac-item--flash' : 'btg-ac-item'}
                    draggable={canEdit}
                    data-dragging={drag === i}
                    data-over={over === i && drag !== i}
                    data-carry={carryLibIds.has(it.libraryItemId)}
                    onDragStart={() => setDrag(i)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOver(i);
                    }}
                    onDrop={() => {
                      if (drag !== null) move(drag, i);
                      setDrag(null);
                      setOver(null);
                    }}
                    onDragEnd={() => {
                      setDrag(null);
                      setOver(null);
                    }}
                  >
                    <span className="btg-drag"><Icon name="drag_indicator" /></span>
                    <span className="btg-mono btg-mute btg-ac-hide-sm" style={{ fontSize: 13 }}>{i + 1}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span className="btg-stripe" style={{ background: p.color, height: 28 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 15, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                          {it.libraryItem.title}
                          {carryLibIds.has(it.libraryItemId) && <span className="btg-ac-tag" style={{ color: 'var(--btg-secondary)' }}>Carry-over</span>}
                          {it.outcome !== 'PENDING' && (
                            <span className="btg-ac-tag" style={{ color: OUTCOMES[it.outcome].color }}>{OUTCOMES[it.outcome].label}</span>
                          )}
                        </span>
                        <span className="btg-mute" style={{ fontSize: 12 }}>
                          {p.label}
                          {topic ? ` · ${topic}` : ''} · {it.libraryItem.estimatedMinutes} min
                          {it.scheduledAt &&
                            ` · ${new Date(it.scheduledAt).toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '')}`}
                          {overflowIds.has(it.libraryItemId) && <span style={{ color: 'var(--btg-stuck)' }}> · não cabe na agenda</span>}
                        </span>
                      </div>
                    </div>
                    <span className="btg-soft btg-ac-hide-sm" style={{ fontSize: 13 }}>{lib ? DIFFICULTY[lib.difficulty] ?? '' : ''}</span>
                    <span className="btg-mono btg-ac-hide-sm" style={{ fontSize: 13, textAlign: 'right' }}>{it.libraryItem.estimatedMinutes} min</span>
                    <span className="btg-ac-item-actions">
                      {canEdit && (
                        <>
                          <button type="button" className="btg-icon-btn" aria-label="Subir" disabled={i === 0} onClick={() => move(i, i - 1)}>
                            <Icon name="arrow_upward" />
                          </button>
                          <button type="button" className="btg-icon-btn" aria-label="Descer" disabled={i === plan.items.length - 1} onClick={() => move(i, i + 1)}>
                            <Icon name="arrow_downward" />
                          </button>
                          <button
                            type="button"
                            className="btg-icon-btn"
                            aria-label="Remover item"
                            title={locked ? 'Item com progresso não pode ser removido' : undefined}
                            disabled={locked}
                            onClick={() => setItems(plan.items.filter((_, j) => j !== i))}
                          >
                            <Icon name="close" />
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </section>

            {overflow.length > 0 && (
              <section className="btg-card btg-card--pad" style={{ padding: '16px 20px', gap: 10, borderColor: 'var(--btg-stuck)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Icon name="event_busy" style={{ color: 'var(--btg-stuck)' }} />
                  <span style={{ fontSize: 17 }}>Fora da agenda · {overflow.length} {overflow.length === 1 ? 'item' : 'itens'}</span>
                  {canEdit && (
                    <button
                      type="button"
                      className="btg-btn btg-btn--outline btg-btn--sm"
                      style={{ marginLeft: 'auto' }}
                      onClick={() => void reorganizeForFit()}
                      disabled={reorganize.isPending || reschedulePending.isPending}
                    >
                      <Icon name="shuffle" />
                      {reorganize.isPending || reschedulePending.isPending ? 'Reorganizando…' : 'Reorganizar para caber'}
                    </button>
                  )}
                </span>
                <span className="btg-soft" style={{ fontSize: 14 }}>Não cabem na disponibilidade declarada desta semana.</span>
                {overflow.map((o) => {
                  const it = plan.items.find((i) => i.libraryItemId === o.itemId);
                  if (!it) return null;
                  const p = platformOf(it.libraryItem.url, it.libraryItem.format);
                  return (
                    <div key={o.itemId} className="btg-lib-row">
                      <span className="btg-stripe" style={{ background: p.color, height: 28 }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 14 }}>{it.libraryItem.title}</span>
                        <span className="btg-mute btg-mono" style={{ fontSize: 12 }}>{p.label} · faltam {o.minutesRequired} min</span>
                      </div>
                    </div>
                  );
                })}
                <ul className="btg-mute" style={{ fontSize: 13, margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li>
                    Aumentar o limite diário ou abrir uma janela ·{' '}
                    <Link href={`${BTG_ADMIN_BASE}/member/${memberId}`}>ver disponibilidade do membro</Link>
                  </li>
                  <li>Deixar para o próximo plano (vira carry-over)</li>
                  <li>Forçar a publicação no modal de agendamento (os itens vão para depois da janela)</li>
                </ul>
              </section>
            )}

            {context.availability ? (
              <WeekGrid
                weekStart={plan.weekStart}
                availability={context.availability}
                placements={placements}
                busyBlocks={preview.data?.busyBlocks ?? context.availability.busyBlocks ?? []}
                items={plan.items}
                overflowIds={overflowIds}
                updating={!hasPersisted && preview.isFetching}
                stale={!hasPersisted && Boolean(preview.error)}
                onItemClick={highlight}
              />
            ) : (
              <Notice kind="bad">
                <strong style={{ fontWeight: 600 }}>O membro não configurou a disponibilidade</strong>
                <span>
                  Sem ela não dá para prever a agenda. <Link href={`${BTG_ADMIN_BASE}/member/${memberId}`}>Abrir perfil do membro</Link>
                </span>
              </Notice>
            )}

            <section className="btg-card btg-card--pad" style={{ padding: '16px 20px', gap: 8 }}>
              <label className="btg-field">
                <span style={{ fontSize: 17, color: 'var(--btg-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="lock" style={{ color: 'var(--btg-secondary)' }} />
                  Notas do admin
                </span>
                <textarea
                  className="btg-textarea"
                  rows={4}
                  value={plan.adminNotes ?? ''}
                  placeholder="Notas privadas. Só o admin lê."
                  disabled={!canEdit}
                  onChange={(e) => {
                    const adminNotes = e.target.value;
                    setPlan((p) => ({ ...p, adminNotes }));
                    setDirty(true);
                  }}
                />
              </label>
            </section>

            {canEdit && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                {isPublished ? (
                  <button type="button" className="btg-btn btg-btn--primary" onClick={() => void applyEdit()} disabled={editPublished.isPending || plan.items.length === 0}>
                    <Icon name="sync" />
                    {editPublished.isPending ? 'Aplicando…' : 'Aplicar alterações'}
                  </button>
                ) : (
                  <>
                    <button type="button" className="btg-btn btg-btn--ghost" onClick={() => void save()} disabled={busy}>
                      {updatePlan.isPending ? 'Salvando…' : dirty ? 'Salvar rascunho' : 'Rascunho salvo'}
                    </button>
                    <button type="button" className="btg-btn btg-btn--primary" onClick={() => setPublishOpen(true)} disabled={busy || plan.items.length === 0}>
                      <Icon name="publish" />
                      {publishPlan.isPending || autoSchedule.isPending ? 'Publicando…' : 'Publicar…'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      )}

      <AiDraftModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        draft={aiDraft}
        libById={libById}
        topicName={topicName}
        carry={carryLibIds}
        added={inPlan}
        loading={draftAi.isPending}
        onGenerate={(brief) => void generateDraft(brief)}
        onAdd={(ids) => void addItems(ids)}
      />
      <PublishModal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        weekStart={plan.weekStart}
        timezone={context?.availability?.timezone ?? 'America/Sao_Paulo'}
        publishing={publishPlan.isPending || autoSchedule.isPending}
        defaultSendWhatsapp={plan.sendWhatsapp ?? true}
        defaultAutoSchedule={plan.autoSchedule ?? true}
        onSubmit={(o) => void publish(o)}
      />
      <SchedulingModal
        open={scheduling.open}
        phase={scheduling.phase}
        flow={scheduling.flow}
        items={scheduling.items}
        placements={scheduling.placements}
        overflow={scheduling.overflow}
        timezone={context?.availability?.timezone ?? 'America/Sao_Paulo'}
        sessionsFailed={scheduling.sessionsFailed}
        pendingForce={autoSchedule.isPending || editPublished.isPending}
        onClose={closeScheduling}
        onForce={() => void forceFromModal()}
      />
      <Confirm
        open={confirm === 'reschedule'}
        title="Realocar itens pendentes?"
        confirmLabel="Realocar"
        busy={reschedulePending.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void rescheduleNow(false);
        }}
      >
        Os itens pendentes vão para as próximas janelas livres do calendário do membro.
      </Confirm>
      <Confirm
        open={confirm === 'delete'}
        title="Apagar este plano?"
        confirmLabel="Apagar plano"
        danger
        busy={deletePlan.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => void remove()}
      >
        Não dá para desfazer. Os eventos no Google Calendar do membro também são removidos.
      </Confirm>
    </>
  );
}

function PlanLoader({ memberId, planId, weekStart }: { memberId: string; planId: string; weekStart: string | null }) {
  const router = useRouter();
  const isNew = planId === 'new';
  const { data: plan, error } = usePlan(isNew ? null : planId);
  const getOrCreate = useGetOrCreateDraft();

  const create = useCallback(() => {
    getOrCreate.mutate(weekStart ? { memberId, weekStart } : { memberId }, {
      onSuccess: (created) => router.replace(`${BTG_ADMIN_BASE}/member/${memberId}/plan/${created.id}`),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, weekStart]);

  useEffect(() => {
    if (isNew) create();
  }, [isNew, create]);

  if (error) return <Loading label={`Não foi possível abrir o plano · ${error.message}`} />;
  if (getOrCreate.error) {
    return (
      <main className="btg-ac-main">
        <Notice kind="bad">
          <strong style={{ fontWeight: 600 }}>Não foi possível criar o rascunho</strong>
          <span>{(getOrCreate.error as Error).message}</span>
        </Notice>
        <button type="button" className="btg-btn btg-btn--outline btg-btn--sm" style={{ alignSelf: 'flex-start' }} onClick={create}>
          Tentar de novo
        </button>
      </main>
    );
  }
  if (!plan) return <Loading label={isNew ? 'Criando rascunho…' : 'Carregando plano…'} />;
  // key remounts the editor (fresh local state) when the plan changes.
  return <Editor key={plan.id} memberId={memberId} serverPlan={plan} />;
}

function WithWeek({ memberId, planId }: { memberId: string; planId: string }) {
  const weekStart = useSearchParams().get('weekStart');
  // key: navigating plan/<id> → plan/new?weekStart=… must restart the get-or-create flow.
  return <PlanLoader key={`${planId}:${weekStart ?? ''}`} memberId={memberId} planId={planId} weekStart={weekStart} />;
}

export function BtgPlanEditor({ memberId, planId }: { memberId: string; planId: string }) {
  return (
    <Suspense fallback={<Loading />}>
      <WithWeek memberId={memberId} planId={planId} />
    </Suspense>
  );
}
