'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type ChallengeLanguage = 'PYTHON' | 'CPP';
export type ChallengeRating = 'EASY' | 'MEDIUM' | 'HARD' | 'ABANDONED';

export type ChallengeAttempt = {
  id: string;
  userId: string;
  cycleId: string;
  libraryItemId: string;
  language: ChallengeLanguage;
  startedAt: string;
  submittedAt: string | null;
  durationSec: number;
  approachText: string;
  finalCode: string;
  selfRating: ChallengeRating;
  notes: string | null;
  testsPassed: number | null;
  testsTotal: number | null;
  testResults: unknown;
  createdAt: string;
};

export type SandboxRunResult = {
  status: 'OK' | 'TIMEOUT' | 'COMPILE_ERROR' | 'RUNTIME_ERROR' | 'SANDBOX_ERROR';
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type CohortAttempt = {
  id: string;
  user: { id: string; name: string; pictureUrl: string | null };
  language: ChallengeLanguage;
  durationSec: number;
  submittedAt: string;
  selfRating: ChallengeRating;
  approachText: string;
  finalCode: string;
  testsPassed: number | null;
  testsTotal: number | null;
};

export type CohortResponse =
  | { unlocked: false; count: number; attempts: [] }
  | { unlocked: true; count: number; attempts: CohortAttempt[] };

// ────────────────────────────────────────────────────────── start

export function useStartChallenge() {
  return useMutation({
    mutationFn: (input: { libraryItemId: string; language: ChallengeLanguage }) =>
      apiFetch<{ attemptId: string; startedAt: string; starterCode: string }>(
        '/me/challenges/start',
        { method: 'POST', body: JSON.stringify(input) },
      ),
  });
}

// ────────────────────────────────────────────────────────── run (Run button)

export function useRunChallenge() {
  return useMutation({
    mutationFn: (input: {
      attemptId: string;
      language: ChallengeLanguage;
      code: string;
      stdin: string;
    }) =>
      apiFetch<SandboxRunResult>(`/me/challenges/${input.attemptId}/run`, {
        method: 'POST',
        body: JSON.stringify({
          language: input.language,
          code: input.code,
          stdin: input.stdin,
        }),
      }),
  });
}

// ────────────────────────────────────────────────────────── submit / abandon

export function useSubmitChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      attemptId: string;
      language: ChallengeLanguage;
      code: string;
      approachText: string;
      selfRating: 'EASY' | 'MEDIUM' | 'HARD';
      notes?: string;
      libraryItemId: string;
    }) =>
      apiFetch<ChallengeAttempt>(`/me/challenges/${input.attemptId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          language: input.language,
          code: input.code,
          approachText: input.approachText,
          selfRating: input.selfRating,
          notes: input.notes,
        }),
      }),
    onSuccess: (_attempt, v) => {
      // The own-history list + the cohort gate both flip after a successful
      // submit; invalidate both so the item page re-renders correctly.
      qc.invalidateQueries({ queryKey: ['me', 'challenges', 'own', v.libraryItemId] });
      qc.invalidateQueries({ queryKey: ['me', 'challenges', 'cohort', v.libraryItemId] });
    },
  });
}

export function useAbandonChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { attemptId: string; libraryItemId: string }) =>
      apiFetch<ChallengeAttempt>(`/me/challenges/${input.attemptId}/abandon`, {
        method: 'POST',
      }),
    onSuccess: (_a, v) => {
      qc.invalidateQueries({ queryKey: ['me', 'challenges', 'own', v.libraryItemId] });
    },
  });
}

// ────────────────────────────────────────────────────────── autosave

/**
 * Fire-and-forget code save. The frontend debounces calls to ~10s so we
 * don't hammer the server. No cache invalidation — the response carries
 * no payload the UI needs.
 */
export function useAutoSaveCode() {
  return useMutation({
    mutationFn: (input: {
      attemptId: string;
      language: ChallengeLanguage;
      code: string;
    }) =>
      apiFetch<{ ok: true }>(`/me/challenges/${input.attemptId}/code`, {
        method: 'POST',
        body: JSON.stringify({
          language: input.language,
          code: input.code,
        }),
      }),
  });
}

// ────────────────────────────────────────────────────────── reads

export type ChallengeAttemptDetail = ChallengeAttempt & {
  libraryItem: {
    id: string;
    title: string;
    url: string | null;
    description: string | null;
    testCases:
      | Array<{ name: string; stdin: string; expectedStdout: string; hidden?: boolean }>
      | null;
    testCasesLanguages: ChallengeLanguage[];
  };
};

export function useChallengeAttempt(attemptId: string | null | undefined) {
  return useQuery({
    queryKey: ['me', 'challenges', 'attempt', attemptId],
    queryFn: () => apiFetch<ChallengeAttemptDetail>(`/me/challenges/${attemptId}`),
    enabled: Boolean(attemptId),
    // Server holds the canonical startedAt and durationSec; we don't want
    // the editor to refetch and reset the timer mid-attempt.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}

export function useMyChallengesOnItem(libraryItemId: string | null | undefined) {
  return useQuery({
    queryKey: ['me', 'challenges', 'own', libraryItemId],
    queryFn: () =>
      apiFetch<ChallengeAttempt[]>(
        `/me/challenges?libraryItemId=${libraryItemId}`,
      ),
    enabled: Boolean(libraryItemId),
  });
}

export function useCohortChallengesOnItem(libraryItemId: string | null | undefined) {
  return useQuery({
    queryKey: ['me', 'challenges', 'cohort', libraryItemId],
    queryFn: () =>
      apiFetch<CohortResponse>(
        `/me/challenges/cohort?libraryItemId=${libraryItemId}`,
      ),
    enabled: Boolean(libraryItemId),
  });
}
