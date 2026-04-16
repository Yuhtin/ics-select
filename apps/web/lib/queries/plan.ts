'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type PlanItem = {
  id: string;
  status: 'PENDING' | 'DONE';
  stuck: boolean;
  completionStatus?: 'DONE' | 'STUCK' | 'DOUBTS' | null;
  feedback?: string | null;
  order: number;
  libraryItem: {
    id: string;
    title: string;
    description?: string | null;
    estimatedMinutes: number;
    url: string | null;
    format: string;
  };
  sessions: Array<{ id: string; scheduledAt: string; durationMinutes: number }>;
};

export type Plan = {
  id: string;
  status: string;
  weekStart: string;
  weekEnd: string;
  userId: string;
  cycleId: string;
  items: PlanItem[];
};

export function usePlan(id: string | null) {
  return useQuery({
    queryKey: ['plan', id],
    queryFn: () => apiFetch<Plan>(`/plans/${id}`),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export function usePrefetchPlan() {
  const qc = useQueryClient();
  return (id: string) =>
    qc.prefetchQuery({
      queryKey: ['plan', id],
      queryFn: () => apiFetch<Plan>(`/plans/${id}`),
      staleTime: 30_000,
    });
}
