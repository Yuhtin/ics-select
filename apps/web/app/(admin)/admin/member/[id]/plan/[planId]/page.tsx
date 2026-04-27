'use client';
import { use, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { addToast } from '@heroui/react';
import { useAdminPlanContext } from '../../../../../../../lib/queries/admin-plan-context';
import {
  useGetOrCreateDraft,
  usePlan,
  useUpdatePlan,
  useDraftAiPlan,
  usePublishPlan,
  useAutoSchedulePlan,
  useDeletePlan,
  useEditPublishedPlan,
  useReschedulePending,
  type WeeklyPlan,
  type WeeklyPlanItem,
  type AiDraft,
} from '../../../../../../../lib/queries/admin-plan-editor';
import { useTopics } from '../../../../../../../lib/queries/admin-topics';
import type { LibraryItem } from '../../../../../../../lib/queries/library-search';
import { apiFetch, ApiErrorResponse } from '../../../../../../../lib/api/client';
import { ContextPanel } from '../../../../../../../components/admin/plan-editor/context-panel';
import { AiDraftPanel } from '../../../../../../../components/admin/plan-editor/ai-draft-panel';
import { EditablePlanPanel } from '../../../../../../../components/admin/plan-editor/editable-plan-panel';
import { RegenerateBriefModal } from '../../../../../../../components/admin/plan-editor/regenerate-brief-modal';
import {
  OverflowModal,
  type OverflowItem,
} from '../../../../../../../components/admin/plan-editor/overflow-modal';

export default function PlanEditorPage({
  params,
}: {
  params: Promise<{ id: string; planId: string }>;
}) {
  const { id: memberId, planId: initialPlanId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekStartParam = searchParams.get('weekStart');

  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [libraryItems, setLibraryItems] = useState<Map<string, LibraryItem>>(
    new Map(),
  );
  const [carryOverIds, setCarryOverIds] = useState<string[]>([]);
  const [carryOverInitialized, setCarryOverInitialized] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [overflowState, setOverflowState] = useState<{
    open: boolean;
    overflow: OverflowItem[];
  }>({ open: false, overflow: [] });

  // Bootstrap: either fetch existing or create-or-get draft
  const { data: fetchedPlan, error: planError } = usePlan(
    initialPlanId === 'new' ? null : initialPlanId,
  );
  const getOrCreate = useGetOrCreateDraft();

  useEffect(() => {
    if (plan) return;
    if (initialPlanId === 'new') {
      if (getOrCreate.isPending || getOrCreate.isSuccess) return;
      // When weekStart is provided (from the Plan-week modal), create/return
      // that specific week's plan. Omit it to let the backend auto-pick.
      getOrCreate.mutate(
        weekStartParam ? { memberId, weekStart: weekStartParam } : { memberId },
        {
          onSuccess: (created) => {
            setPlan(created);
            router.replace(`/admin/member/${memberId}/plan/${created.id}`);
          },
        },
      );
    } else if (fetchedPlan) {
      setPlan(fetchedPlan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlanId, fetchedPlan]);

  // Seed libraryItems with plan's existing items so AI panel + editable panel
  // have metadata available immediately.
  useEffect(() => {
    if (!plan) return;
    setLibraryItems((prev) => {
      const next = new Map(prev);
      for (const item of plan.items) {
        if (!next.has(item.libraryItemId)) {
          next.set(item.libraryItemId, {
            id: item.libraryItem.id,
            title: item.libraryItem.title,
            url: item.libraryItem.url ?? null,
            format: item.libraryItem.format,
            difficulty: 'MEDIUM',
            estimatedMinutes: item.libraryItem.estimatedMinutes,
            tags: item.libraryItem.tags ?? [],
            tracks: item.libraryItem.tracks ?? [],
            topicId: item.libraryItem.topicId,
          });
        }
      }
      return next;
    });
  }, [plan]);

  const { data: context } = useAdminPlanContext(memberId, plan?.weekStart);
  const { data: topics } = useTopics();

  const topicNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of topics ?? []) m.set(t.id, t.label);
    return m;
  }, [topics]);

  // Initialize carry-over IDs once when context loads
  useEffect(() => {
    if (!context || carryOverInitialized) return;
    setCarryOverIds(context.carryOverCandidates.map((c) => c.id));
    setCarryOverInitialized(true);
  }, [context, carryOverInitialized]);

  const carryOverLibraryItemIds = useMemo(() => {
    const set = new Set<string>();
    if (!context) return set;
    for (const candidate of context.carryOverCandidates) {
      if (carryOverIds.includes(candidate.id)) set.add(candidate.libraryItemId);
    }
    return set;
  }, [context, carryOverIds]);

  const draftMutation = useDraftAiPlan();
  const updatePlan = useUpdatePlan();
  const publishPlan = usePublishPlan();
  const autoSchedule = useAutoSchedulePlan();
  const deletePlan = useDeletePlan();
  const editPublished = useEditPublishedPlan();
  const reschedulePending = useReschedulePending();

  const fetchMissingLibraryItems = async (ids: string[]): Promise<void> => {
    const unique = Array.from(new Set(ids));
    const missing = unique.filter((id) => !libraryItems.has(id));
    if (missing.length === 0) return;
    const results = await Promise.all(
      missing.map((id) =>
        apiFetch<LibraryItem>(`/library/${id}`).catch(() => null),
      ),
    );
    setLibraryItems((prev) => {
      const next = new Map(prev);
      for (const item of results) if (item) next.set(item.id, item);
      return next;
    });
  };

  async function generateDraft(briefText?: string) {
    if (!plan || !context) return;
    const res = await draftMutation.mutateAsync({
      memberId,
      weekStart: plan.weekStart,
      weekEnd: plan.weekEnd,
      carryOverItemIds: carryOverIds,
      briefText,
    });
    setAiDraft(res.draft);
    const ids = [
      ...res.draft.items.map((i) => i.libraryItemId),
      ...res.draft.alternates.map((a) => a.libraryItemId),
    ];
    await fetchMissingLibraryItems(ids);
    setBriefOpen(false);
  }

  async function handleAddItem(libraryItemId: string) {
    if (!plan) return;
    if (plan.items.some((i) => i.libraryItemId === libraryItemId)) return;
    let libItem = libraryItems.get(libraryItemId);
    if (!libItem) {
      const fetched = await apiFetch<LibraryItem>(
        `/library/${libraryItemId}`,
      ).catch(() => null);
      if (!fetched) return;
      setLibraryItems((prev) => {
        const next = new Map(prev);
        next.set(fetched.id, fetched);
        return next;
      });
      libItem = fetched;
    }
    const newItem: WeeklyPlanItem = {
      id: `local-${crypto.randomUUID()}`,
      libraryItemId: libItem.id,
      order: plan.items.length,
      outcome: 'PENDING',
      skippable: (libItem.topics ?? []).some((t) => t.slug === 'foundations'),
      libraryItem: {
        id: libItem.id,
        title: libItem.title,
        estimatedMinutes: libItem.estimatedMinutes,
        format: libItem.format,
        url: libItem.url,
        topicId: libItem.topicId,
        tags: libItem.tags,
        tracks: libItem.tracks,
      },
    };
    setPlan({ ...plan, items: [...plan.items, newItem] });
  }

  function handleItemsChange(items: WeeklyPlanItem[]) {
    if (!plan) return;
    setPlan({ ...plan, items });
  }

  function handleAdminNotesChange(notes: string) {
    if (!plan) return;
    setPlan({ ...plan, adminNotes: notes });
  }

  async function handleSaveDraft() {
    if (!plan) return;
    const saved = await updatePlan.mutateAsync({
      planId: plan.id,
      adminNotes: plan.adminNotes ?? undefined,
      items: plan.items.map((i) => ({
        libraryItemId: i.libraryItemId,
        order: i.order,
      })),
    });
    setPlan(saved);
  }

  function navigateAfterPublish() {
    if (context) {
      router.push(`/admin/cycle/${context.cycle.id}`);
    } else {
      router.push(`/admin/member/${memberId}`);
    }
  }

  async function handlePublish(options: {
    publishAt: string | null;
    sendWhatsapp: boolean;
    autoSchedule: boolean;
  }) {
    if (!plan || plan.items.length === 0) return;
    try {
      const saved = await updatePlan.mutateAsync({
        planId: plan.id,
        adminNotes: plan.adminNotes ?? undefined,
        items: plan.items.map((i) => ({
          libraryItemId: i.libraryItemId,
          order: i.order,
        })),
      });
      setPlan(saved);
      const publishRes = await publishPlan.mutateAsync({
        planId: plan.id,
        publishAt: options.publishAt,
        sendWhatsapp: options.sendWhatsapp,
        autoSchedule: options.autoSchedule,
      });
      // Scheduled-publish path: cron handles autoSchedule + WhatsApp later.
      if (publishRes.deferred) {
        addToast({
          title: 'Plan scheduled',
          description: options.publishAt
            ? `Goes live at ${new Date(options.publishAt).toLocaleString('pt-BR')}.`
            : 'Scheduled for the future.',
          color: 'success',
        });
        navigateAfterPublish();
        return;
      }
      // Immediate publish path: only auto-schedule if admin opted in.
      if (!options.autoSchedule) {
        addToast({ title: 'Plan published', color: 'success' });
        navigateAfterPublish();
        return;
      }
      const res = await autoSchedule.mutateAsync({
        planId: plan.id,
        force: false,
      });
      if (res.overflow && res.overflow.length > 0) {
        setOverflowState({ open: true, overflow: res.overflow });
        return;
      }
      const failed = res.sessionsFailed ?? 0;
      addToast({
        title: failed > 0 ? 'Plan published with calendar errors' : 'Plan published',
        description:
          failed > 0
            ? `${res.sessionsCreated} session${res.sessionsCreated === 1 ? '' : 's'} on calendar · ${failed} failed (check Google connection).`
            : `${res.sessionsCreated} session${res.sessionsCreated === 1 ? '' : 's'} scheduled.`,
        color: failed > 0 ? 'warning' : 'success',
      });
      navigateAfterPublish();
    } catch (err) {
      if (
        err instanceof ApiErrorResponse &&
        err.apiError?.code === 'PLAN_OVERFLOW'
      ) {
        const overflow =
          (err.apiError.details as { overflow?: OverflowItem[] } | undefined)
            ?.overflow ?? [];
        setOverflowState({ open: true, overflow });
      } else {
        addToast({
          title: 'Publish failed',
          description: err instanceof Error ? err.message : 'Unknown error',
          color: 'danger',
        });
        throw err;
      }
    }
  }

  async function handleApplyEdit(force = false) {
    if (!plan) return;
    try {
      const res = await editPublished.mutateAsync({
        planId: plan.id,
        adminNotes: plan.adminNotes ?? undefined,
        items: plan.items.map((i) => ({
          libraryItemId: i.libraryItemId,
          order: i.order,
        })),
        force,
      });
      setPlan(res.plan);
      const { addedCount, removedCount, sessionsCreated, sessionsFailed } = res.scheduling;
      const parts: string[] = [];
      if (addedCount > 0) parts.push(`+${addedCount} added`);
      if (removedCount > 0) parts.push(`−${removedCount} removed`);
      if (sessionsCreated > 0) parts.push(`${sessionsCreated} on calendar`);
      if (sessionsFailed > 0) parts.push(`${sessionsFailed} calendar errors`);
      addToast({
        title: sessionsFailed > 0 ? 'Changes applied with calendar errors' : 'Changes applied',
        description: parts.join(' · ') || 'No changes detected.',
        color: sessionsFailed > 0 ? 'warning' : 'success',
      });
      setOverflowState({ open: false, overflow: [] });
    } catch (err) {
      if (
        err instanceof ApiErrorResponse &&
        err.apiError?.code === 'PLAN_OVERFLOW'
      ) {
        const overflow =
          (err.apiError.details as { overflow?: OverflowItem[] } | undefined)
            ?.overflow ?? [];
        setOverflowState({ open: true, overflow });
        return;
      }
      if (
        err instanceof ApiErrorResponse &&
        err.apiError?.code === 'CANT_REMOVE_COMPLETED_ITEM'
      ) {
        addToast({
          title: 'Cannot remove completed items',
          description: 'Items the member already engaged with stay in the plan.',
          color: 'danger',
        });
        return;
      }
      addToast({
        title: 'Apply failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        color: 'danger',
      });
    }
  }

  async function handleForcePublish() {
    if (!plan) return;
    // Overflow modal in edit-published flow → re-call edit with force=true.
    if (plan.status === 'PUBLISHED') {
      await handleApplyEdit(true);
      return;
    }
    try {
      const res = await autoSchedule.mutateAsync({ planId: plan.id, force: true });
      setOverflowState({ open: false, overflow: [] });
      const failed = res.sessionsFailed ?? 0;
      addToast({
        title: failed > 0 ? 'Plan published with calendar errors' : 'Plan published',
        description:
          failed > 0
            ? `${res.sessionsCreated} session${res.sessionsCreated === 1 ? '' : 's'} on calendar · ${failed} failed (check Google connection).`
            : `${res.sessionsCreated} session${res.sessionsCreated === 1 ? '' : 's'} scheduled (overflow forced).`,
        color: failed > 0 ? 'warning' : 'success',
      });
      navigateAfterPublish();
    } catch (err) {
      addToast({
        title: 'Publish failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        color: 'danger',
      });
    }
  }

  async function handleReschedulePending() {
    if (!plan) return;
    const confirmed = window.confirm(
      'Realocar os itens pendentes no calendário da pessoa?',
    );
    if (!confirmed) return;
    try {
      await reschedulePending.mutateAsync(plan.id);
      addToast({
        title: 'Items rescheduled',
        description: 'Pending items have been redistributed in the calendar.',
        color: 'success',
      });
    } catch (err) {
      if (
        err instanceof ApiErrorResponse &&
        err.apiError?.code === 'PLAN_OVERFLOW'
      ) {
        const overflow =
          (err.apiError.details as { overflow?: OverflowItem[] } | undefined)
            ?.overflow ?? [];
        setOverflowState({ open: true, overflow });
      } else {
        addToast({
          title: 'Reschedule failed',
          description: err instanceof Error ? err.message : 'Unknown error',
          color: 'danger',
        });
      }
    }
  }

  async function handleDeletePlan() {
    if (!plan) return;
    const confirmed = window.confirm(
      'Apagar este plano permanentemente? Essa ação não pode ser desfeita. Todos os eventos do Google Calendar também serão removidos.',
    );
    if (!confirmed) return;
    try {
      await deletePlan.mutateAsync(plan.id);
      router.push(`/admin/member/${memberId}`);
    } catch (err) {
      addToast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        color: 'danger',
      });
    }
  }

  // ----- Render -----

  return (
    <>
      <div className="hidden xl:block">
        <header className="mb-6 flex items-center gap-3">
          <Link
            href={context ? `/admin/cycle/${context.cycle.id}` : `/admin`}
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-label text-ink-mute hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            Back
          </Link>
          {plan && (
            <span className="font-mono text-xs text-ink-mute">
              {plan.status} · plan {plan.id.slice(0, 6)}
            </span>
          )}
          {plan && plan.status === 'PUBLISHED' && (
            <button
              type="button"
              onClick={() => { void handleReschedulePending(); }}
              disabled={reschedulePending.isPending}
              className="ml-auto inline-flex items-center gap-1.5 rounded-pill border border-rule px-3 py-1 font-mono text-[10px] uppercase tracking-label text-ink-soft hover:border-ink-soft hover:bg-paper-warm disabled:opacity-50"
            >
              {reschedulePending.isPending ? 'Rescheduling…' : 'Reschedule pending'}
            </button>
          )}
          {plan && (
            <button
              type="button"
              onClick={() => { void handleDeletePlan(); }}
              disabled={deletePlan.isPending}
              className={`${plan.status === 'PUBLISHED' ? '' : 'ml-auto '}inline-flex items-center gap-1.5 rounded-pill border border-outcome-stuck/40 px-3 py-1 font-mono text-[10px] uppercase tracking-label text-outcome-stuck hover:border-outcome-stuck hover:bg-outcome-stuck/5 disabled:opacity-50`}
            >
              {deletePlan.isPending ? 'Deleting…' : 'Delete plan'}
            </button>
          )}
        </header>

        {planError ? (
          <p className="inline-flex items-center gap-2 rounded-pill bg-outcome-stuck/10 px-3 py-1.5 font-mono text-xs uppercase tracking-label text-outcome-stuck">
            Failed to load plan · {planError.message}
          </p>
        ) : getOrCreate.error ? (
          <div className="rounded-card border border-outcome-stuck/30 bg-outcome-stuck/5 p-4 font-mono text-xs uppercase tracking-label text-outcome-stuck">
            <p>Failed to create draft · {(getOrCreate.error as Error).message}</p>
            <button
              type="button"
              onClick={() => getOrCreate.reset()}
              className="mt-2 rounded-pill bg-outcome-stuck px-3 py-1 font-mono text-[10px] uppercase tracking-label text-paper hover:opacity-90"
            >
              Retry
            </button>
          </div>
        ) : !plan ? (
          <p className="font-mono text-xs uppercase tracking-label text-ink-mute">
            {initialPlanId === 'new' ? 'Creating draft…' : 'Loading plan…'}
          </p>
        ) : !context ? (
          <p className="font-mono text-xs uppercase tracking-label text-ink-mute">
            Loading context…
          </p>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
              <ContextPanel
                data={context}
                carryOverIds={carryOverIds}
                onCarryOverChange={setCarryOverIds}
              />
            </div>
            <div className="col-span-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
              <AiDraftPanel
                draft={aiDraft}
                libraryById={libraryItems}
                topicNameById={topicNameById}
                carryOverLibraryItemIds={carryOverLibraryItemIds}
                addedLibraryItemIds={
                  new Set(plan.items.map((i) => i.libraryItemId))
                }
                loading={draftMutation.isPending}
                onGenerate={(brief) => {
                  void generateDraft(brief);
                }}
                onOpenBrief={() => setBriefOpen(true)}
                onAddItem={(id) => {
                  void handleAddItem(id);
                }}
              />
            </div>
            <div className="col-span-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
              <EditablePlanPanel
                plan={plan}
                context={context}
                topicNameById={topicNameById}
                carryOverLibraryItemIds={carryOverLibraryItemIds}
                onItemsChange={handleItemsChange}
                onAdminNotesChange={handleAdminNotesChange}
                onAddLibraryItem={(id) => {
                  void handleAddItem(id);
                }}
                onSaveDraft={() => {
                  void handleSaveDraft();
                }}
                onPublish={(options) => {
                  void handlePublish(options);
                }}
                onApplyEdit={() => {
                  void handleApplyEdit();
                }}
                saving={updatePlan.isPending}
                publishing={
                  publishPlan.isPending || autoSchedule.isPending
                }
                applyingEdit={editPublished.isPending}
              />
            </div>
          </div>
        )}

        <RegenerateBriefModal
          open={briefOpen}
          onClose={() => setBriefOpen(false)}
          onSubmit={(brief) => {
            void generateDraft(brief);
          }}
          loading={draftMutation.isPending}
        />
        <OverflowModal
          open={overflowState.open}
          overflow={overflowState.overflow}
          memberName={context?.member.name ?? ''}
          onClose={() => setOverflowState({ open: false, overflow: [] })}
          onForce={() => {
            void handleForcePublish();
          }}
          pending={autoSchedule.isPending || editPublished.isPending}
        />
      </div>

      <div className="xl:hidden p-12 text-center">
        <p className="font-serif-tool text-xl font-semibold">
          Plan editor is desktop-only
        </p>
        <p className="mt-2 font-sans text-sm text-ink-soft">
          Resize to at least 1280px width.
        </p>
      </div>
    </>
  );
}
