'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export const MOCK_TYPES = ['BEHAVIORAL', 'CODING', 'SYSTEM_DESIGN'] as const;
export type MockType = (typeof MOCK_TYPES)[number];

export type AdminMock = {
  id: string;
  userId: string;
  cycleId: string;
  type: MockType;
  score: number;
  feedback: string | null;
  conductedBy: string | null;
  conductedAt: string;
  topics: string[];
  createdAt: string;
};

export function useAdminMocks(
  userId: string | null | undefined,
  cycleId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['admin', 'mocks', userId, cycleId ?? 'all'],
    queryFn: () =>
      apiFetch<AdminMock[]>(
        `/admin/mocks?userId=${userId}${cycleId ? `&cycleId=${cycleId}` : ''}`,
      ),
    enabled: Boolean(userId),
  });
}

type CreateInput = {
  userId: string;
  cycleId: string;
  type: MockType;
  score: number;
  feedback?: string;
  conductedBy?: string;
  conductedAt?: string;
  topics?: string[];
};

export function useCreateMock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInput) =>
      apiFetch<AdminMock>('/admin/mocks', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_mock, v) => {
      qc.invalidateQueries({ queryKey: ['admin', 'mocks', v.userId] });
      // The cockpit KPI strip aggregates mocks too; invalidate the cockpit
      // so the avg-score chip refreshes without a manual reload.
      qc.invalidateQueries({ queryKey: ['admin', 'cockpit', v.userId] });
    },
  });
}

type UpdateInput = {
  id: string;
  userId: string;
  type?: MockType;
  score?: number;
  feedback?: string | null;
  conductedBy?: string | null;
  conductedAt?: string;
  topics?: string[];
};

export function useUpdateMock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateInput) => {
      const { id, userId: _userId, ...body } = input;
      return apiFetch<AdminMock>(`/admin/mocks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_mock, v) => {
      qc.invalidateQueries({ queryKey: ['admin', 'mocks', v.userId] });
      qc.invalidateQueries({ queryKey: ['admin', 'cockpit', v.userId] });
    },
  });
}

export function useDeleteMock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; userId: string }) =>
      apiFetch<{ ok: boolean }>(`/admin/mocks/${input.id}`, { method: 'DELETE' }),
    onSuccess: (_ok, v) => {
      qc.invalidateQueries({ queryKey: ['admin', 'mocks', v.userId] });
      qc.invalidateQueries({ queryKey: ['admin', 'cockpit', v.userId] });
    },
  });
}
