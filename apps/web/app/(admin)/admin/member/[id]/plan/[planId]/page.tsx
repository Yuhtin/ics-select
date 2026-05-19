'use client';
import { use, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { addToast } from '@heroui/react';
import { allocatedMinutes } from '@ics-select/shared';
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
  type SchedulingPlacement,
} from '../../../../../../../lib/queries/admin-plan-editor';
import {
  useSchedulingPreview,
  useReorganizeForFit,
  type PreviewItem,
} from '../../../../../../../lib/queries/admin-plan-preview';
import { useTopics } from '../../../../../../../lib/queries/admin-topics';
import type { LibraryItem } from '../../../../../../../lib/queries/library-search';
import { apiFetch, ApiErrorResponse } from '../../../../../../../lib/api/client';
import { ContextSidebar } from '../../../../../../../components/admin/plan-editor/context-sidebar';
import { AiSuggestDrawer } from '../../../../../../../components/admin/plan-editor/ai-suggest-drawer';
import {
  WeekPreview,
  type WeekAvailability,
} from '../../../../../../../components/admin/plan-editor/week-preview';
import type { DayCardSlot } from '../../../../../../../components/admin/plan-editor/week-day-card';
import { UnscheduledSection } from '../../../../../../../components/admin/plan-editor/unscheduled-section';
import { EditablePlanPanel } from '../../../../../../../components/admin/plan-editor/editable-plan-panel';
import {
  SchedulingModal,
  type SchedulingPhase,
} from '../../../../../../../components/admin/plan-editor/scheduling-modal';
import { ConfirmDialog } from '../../../../../../../components/ui/confirm-dialog';

type SchedulingState = {
  open: boolean;
  phase: SchedulingPhase;
  /** Which flow opened this modal — drives the close-button behavior (publish navigates away on Concluir; edit stays). */
  flow: 'publish' | 'edit';
  /** Items participating in this scheduling pass (for autoSchedule: all non-skipped; for editPublished: added items snapshot). */
  items: WeeklyPlanItem[];
  placements: SchedulingPlacement[];
  overflow: Array<{ itemId: string; minutesRequired: number }>;
  sessionsFailed: number;
};

const INITIAL_SCHEDULING_STATE: SchedulingState = {
  open: false,
  phase: 'pending',
  flow: 'publish',
  items: [],
  placements: [],
  overflow: [],
  sessionsFailed: 0,
};

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
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [scheduling, setScheduling] = useState<SchedulingState>(INITIAL_SCHEDULING_STATE);
  const [rescheduleConfirmOpen, setRescheduleConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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
  const reorganize = useReorganizeForFit();

  const previewItems: PreviewItem[] = useMemo(
    () =>
      (plan?.items ?? []).map((i) => ({
        libraryItemId: i.libraryItemId,
        order: i.order,
        // Match what publish/autoSchedule will actually request from the
        // scheduler. VIDEO formats double in `allocatedMinutes` (we know mexer
        // com vídeo custa o dobro do duration cru). Passing the raw value here
        // made the preview optimistic — it would show items fitting that
        // publish later kicked into overflow.
        estimatedMinutes: allocatedMinutes(i.libraryItem.estimatedMinutes, i.libraryItem.format),
      })),
    [plan?.items],
  );

  const persistedPlacements = useMemo<SchedulingPlacement[]>(
    () =>
      (plan?.items ?? [])
        .filter((i) => i.scheduledAt && i.scheduledMinutes)
        .map((i) => ({
          itemId: i.libraryItemId,
          scheduledAt: i.scheduledAt!,
          durationMinutes: i.scheduledMinutes!,
        })),
    [plan?.items],
  );

  const hasPersisted = persistedPlacements.length > 0;

  // Preview runs for DRAFT plans AND for PUBLISHED plans whose autoSchedule
  // failed (no item.scheduledAt set yet) — that way the editor doesn't go
  // blank after an overflow on publish; admin still sees what would fit.
  const previewEnabled = Boolean(
    plan && previewItems.length > 0 && context?.availability && !hasPersisted,
  );

  const preview = useSchedulingPreview(plan?.id ?? null, previewItems, previewEnabled);

  const placements = useMemo<SchedulingPlacement[]>(() => {
    if (hasPersisted) return persistedPlacements;
    return (preview.data?.placements ?? []).map((p) => ({
      itemId: p.itemId,
      scheduledAt: p.scheduledAt,
      durationMinutes: p.durationMinutes,
    }));
  }, [hasPersisted, persistedPlacements, preview.data]);

  const overflow = useMemo<Array<{ itemId: string; minutesRequired: number }>>(() => {
    if (!plan) return [];
    if (!hasPersisted) return preview.data?.overflow ?? [];
    // PUBLISHED (or otherwise persisted) state: any PENDING item without a
    // scheduledAt is effectively overflow — the autoSchedule didn't find a
    // window for it. Surface them so the admin can reorganize.
    return plan.items
      .filter((i) => i.outcome === 'PENDING' && !i.scheduledAt)
      .map((i) => ({
        itemId: i.libraryItemId,
        minutesRequired: i.libraryItem.estimatedMinutes,
      }));
  }, [plan, hasPersisted, preview.data]);

  const overflowItemIds = useMemo(
    () => new Set(overflow.map((o) => o.itemId)),
    [overflow],
  );

  const weekAvailability = useMemo<WeekAvailability>(() => {
    if (!context?.availability) {
      return {
        timezone: 'America/Sao_Paulo',
        capByWeekday: [null, null, null, null, null, null, null],
        slotsByWeekday: [[], [], [], [], [], [], []],
      };
    }
    const a = context.availability;
    const slotsByWeekday: DayCardSlot[][] = [[], [], [], [], [], [], []];
    for (const slot of a.slots ?? []) {
      if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) continue;
      slotsByWeekday[slot.dayOfWeek]!.push({
        startMinute: slot.startMinute,
        endMinute: slot.endMinute,
      });
    }
    for (const bucket of slotsByWeekday) {
      bucket.sort((s1, s2) => s1.startMinute - s2.startMinute);
    }
    return {
      timezone: a.timezone,
      capByWeekday: [
        a.mondayMinutes,
        a.tuesdayMinutes,
        a.wednesdayMinutes,
        a.thursdayMinutes,
        a.fridayMinutes,
        a.saturdayMinutes,
        a.sundayMinutes,
      ].map((m) => (m > 0 ? m : null)),
      slotsByWeekday,
    };
  }, [context]);

  function handleHighlightItemRow(libId: string) {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(`plan-item-${libId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-focus/40');
    setTimeout(() => el.classList.remove('ring-2', 'ring-focus/40'), 2000);
  }

  async function handleReorganize() {
    if (!plan || previewItems.length === 0) return;
    if (plan.status === 'PUBLISHED') {
      await handleReorganizePublished();
      return;
    }
    try {
      const res = await reorganize.mutateAsync({
        planId: plan.id,
        items: previewItems,
      });
      // Rebuild the editor list order from the relaxed result: items grouped
      // by earliest scheduledAt asc; items still in overflow appended after.
      const earliestByLibId = new Map<string, string>();
      for (const p of res.placements) {
        const prev = earliestByLibId.get(p.itemId);
        if (!prev || p.scheduledAt < prev) earliestByLibId.set(p.itemId, p.scheduledAt);
      }
      const placed = plan.items
        .filter((i) => earliestByLibId.has(i.libraryItemId))
        .sort((a, b) =>
          earliestByLibId.get(a.libraryItemId)!.localeCompare(
            earliestByLibId.get(b.libraryItemId)!,
          ),
        );
      const overflowIds = new Set(res.overflow.map((o) => o.itemId));
      const overflowItems = plan.items.filter((i) => overflowIds.has(i.libraryItemId));
      const reordered = [...placed, ...overflowItems].map((i, idx) => ({
        ...i,
        order: idx,
      }));
      setPlan({ ...plan, items: reordered });
      const fit = res.placements.length > 0 ? new Set(res.placements.map((p) => p.itemId)).size : 0;
      const total = previewItems.length;
      addToast({
        title:
          res.overflow.length === 0
            ? `Reorganizado · ${fit}/${total} encaixaram`
            : `Reorganizado · ${fit}/${total} encaixaram · ${res.overflow.length} ainda fora`,
        description:
          'A ordem pedagógica foi relaxada. Salve o draft pra persistir.',
        color: res.overflow.length === 0 ? 'success' : 'warning',
      });
    } catch (err) {
      addToast({
        title: 'Reorganize falhou',
        description: err instanceof Error ? err.message : 'Unknown error',
        color: 'danger',
      });
    }
  }

  async function handleReorganizePublished() {
    if (!plan) return;
    const pendingCount = plan.items.filter((i) => i.outcome === 'PENDING').length;
    if (pendingCount === 0) {
      addToast({
        title: 'Nada pra reorganizar',
        description: 'Todos os items já têm outcome — só items PENDING são reescalados.',
        color: 'warning',
      });
      return;
    }
    try {
      await reschedulePending.mutateAsync({
        planId: plan.id,
        relaxOrder: true,
      });
      addToast({
        title: 'Reorganizado · items PENDING reescalados',
        description: `${pendingCount} item${pendingCount === 1 ? '' : 's'} redistribuído${pendingCount === 1 ? '' : 's'} no calendário. Items já marcados não foram tocados.`,
        color: 'success',
      });
    } catch (err) {
      const overflow = extractOverflow(err);
      if (overflow !== null) {
        addToast({
          title: 'Reorganize · ainda sobrou overflow',
          description: `${overflow.length} item${overflow.length === 1 ? '' : 'ns'} continuam sem janela. Aumente disponibilidade ou remova items.`,
          color: 'warning',
        });
        return;
      }
      addToast({
        title: 'Reorganize falhou',
        description: err instanceof Error ? err.message : 'Unknown error',
        color: 'danger',
      });
    }
  }

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
      scheduledAt: null,
      scheduledMinutes: null,
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

  function extractOverflow(err: unknown): Array<{ itemId: string; minutesRequired: number }> | null {
    if (!(err instanceof ApiErrorResponse) || err.apiError?.code !== 'PLAN_OVERFLOW') {
      return null;
    }
    const details = err.apiError.details as
      | { overflow?: Array<{ itemId: string; minutesRequired: number }> }
      | undefined;
    return details?.overflow ?? [];
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
      // Reflect the new status (PUBLISHED for immediate, SCHEDULED for
      // deferred) in local state. Without this, if autoSchedule below throws
      // PLAN_OVERFLOW, the panel keeps showing Save/Publish buttons that 409
      // because the plan is already PUBLISHED on the server.
      setPlan((prev) => (prev ? { ...prev, status: publishRes.plan.status } : prev));
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
      // Open SchedulingModal in pending state — the autoSchedule call below
      // takes ~1s (scheduler <100ms + Google Calendar createEvent ×N). The
      // modal gives the admin live feedback during that gap.
      const schedulableItems = saved.items.filter((i) => i.outcome !== 'SKIPPED');
      setScheduling({
        open: true,
        phase: 'pending',
        flow: 'publish',
        items: schedulableItems,
        placements: [],
        overflow: [],
        sessionsFailed: 0,
      });
      try {
        const res = await autoSchedule.mutateAsync({ planId: plan.id, force: false });
        setScheduling((prev) => ({
          ...prev,
          phase: 'done',
          placements: res.placements,
          overflow: res.overflow,
          sessionsFailed: res.sessionsFailed,
        }));
      } catch (err) {
        const overflow = extractOverflow(err);
        if (overflow !== null) {
          setScheduling((prev) => ({
            ...prev,
            phase: 'overflow',
            placements: [],
            overflow,
          }));
          return;
        }
        setScheduling(INITIAL_SCHEDULING_STATE);
        addToast({
          title: 'Publish failed',
          description: err instanceof Error ? err.message : 'Unknown error',
          color: 'danger',
        });
      }
    } catch (err) {
      addToast({
        title: 'Publish failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        color: 'danger',
      });
      throw err;
    }
  }

  async function handleApplyEdit(force = false) {
    if (!plan) return;
    // Snapshot items before mutate — for the modal's pending-state list. After
    // editPublished resolves we know which were added/removed via response counts.
    const itemsSnapshot = plan.items.slice();
    setScheduling({
      open: true,
      phase: 'pending',
      flow: 'edit',
      items: itemsSnapshot,
      placements: [],
      overflow: [],
      sessionsFailed: 0,
    });
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
      // Re-snapshot from the fresh plan so the modal can show added items by id.
      setScheduling((prev) => ({
        ...prev,
        phase: 'done',
        items: res.plan.items.filter((i) => i.outcome !== 'SKIPPED'),
        placements: res.scheduling.placements,
        overflow: res.scheduling.overflow,
        sessionsFailed: res.scheduling.sessionsFailed,
      }));
    } catch (err) {
      const overflow = extractOverflow(err);
      if (overflow !== null) {
        setScheduling((prev) => ({
          ...prev,
          phase: 'overflow',
          placements: [],
          overflow,
        }));
        return;
      }
      setScheduling(INITIAL_SCHEDULING_STATE);
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

  async function handleForceFromModal() {
    if (scheduling.flow === 'edit') {
      await handleApplyEdit(true);
      return;
    }
    if (!plan) return;
    // Re-run autoSchedule with force=true. Keep the modal open in pending
    // state so the admin sees the same visual feedback during the retry.
    setScheduling((prev) => ({ ...prev, phase: 'pending', placements: [], overflow: [] }));
    try {
      const res = await autoSchedule.mutateAsync({ planId: plan.id, force: true });
      setScheduling((prev) => ({
        ...prev,
        phase: 'done',
        placements: res.placements,
        overflow: res.overflow,
        sessionsFailed: res.sessionsFailed,
      }));
    } catch (err) {
      setScheduling(INITIAL_SCHEDULING_STATE);
      addToast({
        title: 'Publish failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        color: 'danger',
      });
    }
  }

  function handleSchedulingClose() {
    // After a fresh publish (flow === 'publish' && phase === 'done'), close
    // navigates away to the cycle page. For edit-published or for dismissing
    // an overflow, just close — local plan state is already up-to-date.
    const shouldNavigate = scheduling.flow === 'publish' && scheduling.phase === 'done';
    setScheduling(INITIAL_SCHEDULING_STATE);
    if (shouldNavigate) navigateAfterPublish();
  }

  async function handleReschedulePending() {
    if (!plan) return;
    setRescheduleConfirmOpen(false);
    try {
      await reschedulePending.mutateAsync(plan.id);
      addToast({
        title: 'Items rescheduled',
        description: 'Pending items have been redistributed in the calendar.',
        color: 'success',
      });
    } catch (err) {
      const overflow = extractOverflow(err);
      if (overflow !== null) {
        addToast({
          title: 'Reschedule overflow',
          description: `${overflow.length} item${overflow.length === 1 ? '' : 'ns'} sem janela disponível. Ajuste a disponibilidade ou o plano.`,
          color: 'warning',
        });
        return;
      }
      addToast({
        title: 'Reschedule failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        color: 'danger',
      });
    }
  }

  async function handleDeletePlan() {
    if (!plan) return;
    setDeleteConfirmOpen(false);
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
          {plan && plan.status === 'DRAFT' && (
            <button
              type="button"
              onClick={() => setAiDrawerOpen(true)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-pill border border-rule px-3 py-1 font-mono text-[10px] uppercase tracking-label text-ink-soft hover:border-ink-soft hover:bg-paper-warm"
            >
              <Sparkles className="h-3 w-3" strokeWidth={1.5} />
              Sugerir com IA
            </button>
          )}
          {plan && plan.status === 'PUBLISHED' && (
            <button
              type="button"
              onClick={() => setRescheduleConfirmOpen(true)}
              disabled={reschedulePending.isPending}
              className="ml-auto inline-flex items-center gap-1.5 rounded-pill border border-rule px-3 py-1 font-mono text-[10px] uppercase tracking-label text-ink-soft hover:border-ink-soft hover:bg-paper-warm disabled:opacity-50"
            >
              {reschedulePending.isPending ? 'Rescheduling…' : 'Reschedule pending'}
            </button>
          )}
          {plan && (
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deletePlan.isPending}
              className={`${plan.status === 'DRAFT' || plan.status === 'PUBLISHED' ? '' : 'ml-auto '}inline-flex items-center gap-1.5 rounded-pill border border-outcome-stuck/40 px-3 py-1 font-mono text-[10px] uppercase tracking-label text-outcome-stuck hover:border-outcome-stuck hover:bg-outcome-stuck/5 disabled:opacity-50`}
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
          <>
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-8">
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
                  publishing={publishPlan.isPending || autoSchedule.isPending}
                  applyingEdit={editPublished.isPending}
                />
              </div>
              <aside className="col-span-4">
                <ContextSidebar
                  data={context}
                  carryOverIds={carryOverIds}
                  onCarryOverChange={setCarryOverIds}
                  hideCarryOver={plan.status !== 'DRAFT'}
                />
              </aside>
            </div>

            <div className="mt-8">
              {context.availability ? (
                <WeekPreview
                  weekStart={plan.weekStart}
                  availability={weekAvailability}
                  placements={placements}
                  items={plan.items}
                  overflowItemIds={overflowItemIds}
                  isUpdating={!hasPersisted && preview.isFetching}
                  isStale={!hasPersisted && Boolean(preview.error)}
                  onItemClick={handleHighlightItemRow}
                />
              ) : (
                <NoAvailabilityBanner memberId={memberId} />
              )}
            </div>

            <UnscheduledSection
              overflow={overflow}
              items={plan.items}
              memberId={memberId}
              onReorganize={() => {
                void handleReorganize();
              }}
              reorganizing={reorganize.isPending || reschedulePending.isPending}
            />
          </>
        )}

        <AiSuggestDrawer
          open={aiDrawerOpen}
          onClose={() => setAiDrawerOpen(false)}
          draft={aiDraft}
          libraryById={libraryItems}
          topicNameById={topicNameById}
          carryOverLibraryItemIds={carryOverLibraryItemIds}
          addedLibraryItemIds={
            new Set(plan?.items.map((i) => i.libraryItemId) ?? [])
          }
          loading={draftMutation.isPending}
          onGenerate={(brief) => {
            void generateDraft(brief);
          }}
          onAddItem={(id) => {
            void handleAddItem(id);
          }}
        />
        <SchedulingModal
          open={scheduling.open}
          phase={scheduling.phase}
          items={scheduling.items}
          placements={scheduling.placements}
          overflow={scheduling.overflow}
          timezone={context?.availability.timezone ?? 'America/Sao_Paulo'}
          sessionsFailed={scheduling.sessionsFailed}
          pendingForce={autoSchedule.isPending || editPublished.isPending}
          onClose={handleSchedulingClose}
          onForce={() => {
            void handleForceFromModal();
          }}
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

      <ConfirmDialog
        isOpen={rescheduleConfirmOpen}
        onClose={() => {
          if (!reschedulePending.isPending) setRescheduleConfirmOpen(false);
        }}
        onConfirm={() => {
          void handleReschedulePending();
        }}
        title="Realocar itens pendentes?"
        description="Vamos redistribuir os itens pendentes nas próximas janelas livres do calendário da pessoa."
        confirmLabel="Realocar"
        confirmColor="primary"
        isLoading={reschedulePending.isPending}
      />
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          if (!deletePlan.isPending) setDeleteConfirmOpen(false);
        }}
        onConfirm={() => {
          void handleDeletePlan();
        }}
        title="Apagar este plano?"
        description="Essa ação não pode ser desfeita. Todos os eventos no Google Calendar também serão removidos."
        confirmLabel="Apagar plano"
        isLoading={deletePlan.isPending}
      />
    </>
  );
}

function NoAvailabilityBanner({ memberId }: { memberId: string }) {
  return (
    <div className="rounded-card border border-outcome-stuck/40 p-6">
      <p className="mb-2 font-serif-tool text-base text-ink">
        Membro não configurou disponibilidade
      </p>
      <p className="mb-4 font-sans text-sm text-ink-soft">
        Não dá pra prever a agenda sem isso.
      </p>
      <a
        href={`/admin/member/${memberId}/availability`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-pill bg-ink px-3 py-1.5 font-mono text-[11px] uppercase tracking-label text-paper hover:opacity-90"
      >
        Abrir availability
      </a>
    </div>
  );
}
