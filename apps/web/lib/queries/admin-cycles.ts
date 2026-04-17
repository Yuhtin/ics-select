'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type CycleRow = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'ACTIVE' | 'ARCHIVED';
  rankingVisibleToMembers: boolean;
  createdAt: string;
  _count?: { memberships: number };
  memberships?: Array<{ userId: string }>;
};

export function useAdminCycles() {
  return useQuery({
    queryKey: ['admin', 'cycles'],
    queryFn: () => apiFetch<CycleRow[]>('/cycles'),
  });
}

export function useCreateCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; startsAt: string; endsAt: string }) =>
      apiFetch<CycleRow>('/cycles', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'cycles'] }),
  });
}

export function useArchiveCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<CycleRow>(`/cycles/${id}/archive`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'cycles'] }),
  });
}
