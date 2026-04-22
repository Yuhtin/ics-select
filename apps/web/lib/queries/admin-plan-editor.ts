'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ItemOutcome } from '@ics-select/shared';
import { apiFetch } from '../api/client';

export type WeeklyPlanItem = {
  id: string;
  libraryItemId: string;
  order: number;
  outcome: ItemOutcome;
  skippable: boolean;
  libraryItem: {
    id: string;
    title: string;
    estimatedMinutes: number;
    format: string;
    url?: string | null;
    topicId: string | null;
    tags?: string[];
    tracks?: string[];
  };
};

export type WeeklyPlan = {
  id: string;
  userId: string;
  cycleId: string;
  weekStart: string;
  weekEnd: string;
  status: 'DRAFT' | 'PUBLISHED';
  adminNotes: string | null;
  items: WeeklyPlanItem[];
};

export type AiDraft = {
  items: Array<{ libraryItemId: string; order: number; rationale: string }>;
  alternates: Array<{ libraryItemId: string; rationale: string }>;
  narrative: string;
  totalMinutes: number;
};

export type AutoScheduleResponse = {
  sessionsCreated: number;
  sessionsFailed: number;
  overflow: Array<{ itemId: string; minutesRequired: number }>;
};

export function usePlan(planId: string | null | undefined) {
  return useQuery({
    queryKey: ['plan', planId],
    queryFn: () => apiFetch<WeeklyPlan>(`/plans/${planId}`),
    enabled: Boolean(planId) && planId !== 'new',
  });
}

export function useGetOrCreateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { memberId: string; weekStart?: string }) =>
      apiFetch<WeeklyPlan>(`/admin/member/${input.memberId}/plan-drafts`, {
        method: 'POST',
        body: JSON.stringify(input.weekStart ? { weekStart: input.weekStart } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'plans-overview'] });
    },
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      planId: string;
      adminNotes?: string;
      items?: Array<{ libraryItemId: string; order: number }>;
    }) =>
      apiFetch<WeeklyPlan>(`/plans/${input.planId}`, {
        method: 'PATCH',
        body: JSON.stringify({ adminNotes: input.adminNotes, items: input.items }),
      }),
    onSuccess: (plan) => {
      qc.setQueryData(['plan', plan.id], plan);
      qc.invalidateQueries({ queryKey: ['admin', 'plans-overview'] });
    },
  });
}

export function useDraftAiPlan() {
  return useMutation({
    mutationFn: (input: {
      memberId: string;
      weekStart: string;
      weekEnd: string;
      carryOverItemIds?: string[];
      briefText?: string;
    }) =>
      apiFetch<{ draft: AiDraft; usage: unknown }>(`/ai/draft-plan`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function usePublishPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { planId: string }) =>
      apiFetch<{ plan: WeeklyPlan }>(`/plans/${input.planId}/publish`, { method: 'POST' }),
    onSuccess: (res, variables) => {
      qc.invalidateQueries({ queryKey: ['plan', variables.planId] });
      qc.invalidateQueries({ queryKey: ['admin', 'plans-overview'] });
    },
  });
}

export function useAutoSchedulePlan() {
  return useMutation({
    mutationFn: (input: { planId: string; force?: boolean }) =>
      apiFetch<AutoScheduleResponse>(
        `/plans/${input.planId}/auto-schedule${input.force ? '?force=true' : ''}`,
        { method: 'POST' },
      ),
  });
}
