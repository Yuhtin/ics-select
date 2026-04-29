'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type CycleOverviewMember = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  track: string | null;
  percentThisWeek: number;
  done: number;
  total: number;
  hasAlert: boolean;
  availability: {
    itemsCount: number;
    plannedMinutes: number;
    budgetMinutes: number;
  };
};

export type CycleOverviewHeatmapWeek = {
  index: number;
  label: string;
  startsAt: string;
};

export type CycleOverviewHeatmapRow = {
  userId: string;
  name: string;
  cells: number[];
};

export type CycleOverviewFeedEvent = {
  id: string;
  kind: 'finished' | 'got_stuck' | 'had_doubts' | 'posted_retro';
  at: string;
  member: { id: string; name: string; pictureUrl: string | null };
  itemTitle: string | null;
  itemId: string | null;
};

export type CycleOverviewResponse = {
  cycle: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    status: 'ACTIVE' | 'ARCHIVED';
    rankingVisibleToMembers: boolean;
    weekNumber: number;
    weeksTotal: number;
  };
  members: CycleOverviewMember[];
  heatmap: {
    weeks: CycleOverviewHeatmapWeek[];
    rows: CycleOverviewHeatmapRow[];
  };
  feed: CycleOverviewFeedEvent[];
};

export function useAdminCycleOverview(cycleId: string | null | undefined) {
  return useQuery({
    queryKey: ['admin', 'cycle', cycleId],
    queryFn: () => apiFetch<CycleOverviewResponse>(`/admin/cycle/${cycleId}`),
    enabled: Boolean(cycleId),
  });
}

export function useAdminActiveCycleOverview() {
  return useQuery({
    queryKey: ['admin', 'cycle', 'active'],
    queryFn: () => apiFetch<CycleOverviewResponse>('/admin/cycle/active'),
    // 404 when no cycle is ACTIVE — caller renders an empty-state instead of
    // retrying.
    retry: false,
  });
}

export function useToggleRanking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cycleId: string; rankingVisibleToMembers: boolean }) =>
      apiFetch<unknown>(`/cycles/${input.cycleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ rankingVisibleToMembers: input.rankingVisibleToMembers }),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['admin', 'cycle', variables.cycleId] });
      qc.invalidateQueries({ queryKey: ['admin', 'triage'] });
    },
  });
}
