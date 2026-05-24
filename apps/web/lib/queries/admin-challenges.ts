'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type AdminChallengeLanguage = 'PYTHON' | 'CPP';
export type AdminChallengeRating = 'EASY' | 'MEDIUM' | 'HARD' | 'ABANDONED';

export type AdminChallengeAttempt = {
  id: string;
  userId: string;
  cycleId: string;
  libraryItemId: string;
  language: AdminChallengeLanguage;
  startedAt: string;
  submittedAt: string | null;
  durationSec: number;
  approachText: string;
  finalCode: string;
  selfRating: AdminChallengeRating;
  notes: string | null;
  testsPassed: number | null;
  testsTotal: number | null;
  // testResults is the per-case payload (status, stdout, expected, stderr) —
  // shape varies; render defensively.
  testResults: unknown;
  createdAt: string;
  libraryItem: {
    id: string;
    title: string;
    url: string | null;
  };
};

export function useAdminChallenges(
  userId: string | null | undefined,
  cycleId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['admin', 'challenges', userId, cycleId ?? 'all'],
    queryFn: () =>
      apiFetch<AdminChallengeAttempt[]>(
        `/admin/challenges?userId=${userId}${cycleId ? `&cycleId=${cycleId}` : ''}`,
      ),
    enabled: Boolean(userId),
  });
}

export function useDeleteAdminChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; userId: string }) =>
      apiFetch<{ ok: boolean }>(`/admin/challenges/${input.id}`, {
        method: 'DELETE',
      }),
    onSuccess: (_ok, v) => {
      qc.invalidateQueries({ queryKey: ['admin', 'challenges', v.userId] });
    },
  });
}
