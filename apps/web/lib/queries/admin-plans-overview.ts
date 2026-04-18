'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type PlansOverviewStatus = 'all' | 'draft' | 'published';

export type PlansOverviewPlan = {
  id: string;
  status: 'DRAFT' | 'PUBLISHED';
  lastActivityAt: string;
  items: { total: number; done: number };
  user: { id: string; name: string; pictureUrl: string | null };
};

export type PlansOverviewWeek = {
  weekStart: string;
  weekEnd: string;
  plans: PlansOverviewPlan[];
};

export type PlansOverviewResponse = {
  cycle: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    weekNumber: number;
    weeksTotal: number;
  };
  weeks: PlansOverviewWeek[];
};

export function useAdminPlansOverview(
  cycleId: string | null,
  status: PlansOverviewStatus,
) {
  return useQuery({
    queryKey: ['admin', 'plans-overview', cycleId, status],
    queryFn: () =>
      apiFetch<PlansOverviewResponse>(
        `/admin/cycles/${cycleId}/plans?status=${status}`,
      ),
    enabled: Boolean(cycleId),
  });
}
