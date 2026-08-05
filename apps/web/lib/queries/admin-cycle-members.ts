'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

type CycleMemberInput = { cycleId: string; userId: string };

/**
 * Both mutations invalidate the same set: the cycle overview (roster, ranking,
 * heatmap all derive from it), the `active` alias — which may or may not be
 * this cycle, and is cheap to refetch — plus triage, whose alerts are scoped
 * to the cohort that just changed.
 */
function useCycleMemberInvalidation() {
  const qc = useQueryClient();
  return (cycleId: string) => {
    qc.invalidateQueries({ queryKey: ['admin', 'cycle', cycleId] });
    qc.invalidateQueries({ queryKey: ['admin', 'cycle', 'active'] });
    qc.invalidateQueries({ queryKey: ['admin', 'triage'] });
  };
}

export function useAddCycleMember() {
  const invalidate = useCycleMemberInvalidation();
  return useMutation({
    mutationFn: ({ cycleId, userId }: CycleMemberInput) =>
      apiFetch<{ id: string; userId: string; cycleId: string }>(
        `/cycles/${cycleId}/members`,
        { method: 'POST', body: JSON.stringify({ userId }) },
      ),
    onSuccess: (_data, { cycleId }) => invalidate(cycleId),
  });
}

export function useRemoveCycleMember() {
  const invalidate = useCycleMemberInvalidation();
  return useMutation({
    mutationFn: ({ cycleId, userId }: CycleMemberInput) =>
      apiFetch<{ count: number }>(`/cycles/${cycleId}/members/${userId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, { cycleId }) => invalidate(cycleId),
  });
}
