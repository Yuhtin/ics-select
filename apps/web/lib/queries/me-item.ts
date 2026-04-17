'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ItemOutcome } from '@ics-select/shared';
import { apiFetch } from '../api/client';

export type ItemResponse = {
  id: string;
  planId: string;
  order: number;
  outcome: ItemOutcome;
  reflection: string | null;
  completedAt: string | null;
  scheduledAt: string | null;
  scheduledMinutes: number | null;
  libraryItem: {
    id: string;
    title: string;
    description: string | null;
    url: string | null;
    format: string;
    estimatedMinutes: number;
    topic: { slug: string; label: string } | null;
  };
  carriedFrom: {
    outcome: ItemOutcome;
    reflection: string | null;
    completedAt: string | null;
    weekStart: string;
  } | null;
};

export function useMeItem(id: string) {
  return useQuery({
    queryKey: ['me', 'item', id],
    queryFn: () => apiFetch<ItemResponse>(`/me/item/${id}`),
    enabled: !!id,
  });
}

export function useSetItemOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      planId: string;
      itemId: string;
      outcome: ItemOutcome;
      reflection?: string;
    }) =>
      apiFetch<ItemResponse>(
        `/plans/${input.planId}/items/${input.itemId}/outcome`,
        {
          method: 'PATCH',
          body: JSON.stringify({ outcome: input.outcome, reflection: input.reflection }),
        },
      ),
    onSuccess: (_res, input) => {
      qc.invalidateQueries({ queryKey: ['me', 'home'] });
      qc.invalidateQueries({ queryKey: ['me', 'item', input.itemId] });
    },
  });
}
