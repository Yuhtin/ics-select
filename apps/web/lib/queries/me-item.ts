'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ItemOutcome } from '@ics-select/shared';
import { apiFetch } from '../api/client';
import type { HomeResponse, HomeItem } from './me-home';

export type ItemResponse = {
  id: string;
  planId: string;
  order: number;
  outcome: ItemOutcome;
  skippable: boolean;
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

type OutcomeMutationInput = {
  planId: string;
  itemId: string;
  outcome: ItemOutcome;
  reflection?: string;
  actualMinutes?: number | null;
};

type OutcomeMutationContext = {
  prevItem: ItemResponse | undefined;
  prevHome: HomeResponse | undefined;
};

function patchHomeItem(item: HomeItem, itemId: string, outcome: ItemOutcome): HomeItem {
  return item.id === itemId ? { ...item, outcome } : item;
}

function patchHome(home: HomeResponse, itemId: string, outcome: ItemOutcome): HomeResponse {
  return {
    ...home,
    hero:
      home.hero && 'item' in home.hero
        ? { ...home.hero, item: patchHomeItem(home.hero.item, itemId, outcome) }
        : home.hero,
    today: home.today.map((i) => patchHomeItem(i, itemId, outcome)),
    late: home.late?.map((i) => patchHomeItem(i, itemId, outcome)),
    days: home.days.map((d) => ({
      ...d,
      items: d.items.map((i) => patchHomeItem(i, itemId, outcome)),
    })),
    unscheduled: home.unscheduled?.map((i) => patchHomeItem(i, itemId, outcome)),
  };
}

export function useSetItemOutcome() {
  const qc = useQueryClient();
  return useMutation<ItemResponse, Error, OutcomeMutationInput, OutcomeMutationContext>({
    mutationFn: async (input) =>
      apiFetch<ItemResponse>(
        `/plans/${input.planId}/items/${input.itemId}/outcome`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            outcome: input.outcome,
            reflection: input.reflection,
            actualMinutes: input.actualMinutes ?? null,
          }),
        },
      ),
    onMutate: async (input) => {
      // Optimistic update — backend can take a few seconds to apply the
      // outcome; flip the UI instantly so marking feels like a switch, not
      // a round-trip. Snapshots both caches so onError can roll back.
      await Promise.all([
        qc.cancelQueries({ queryKey: ['me', 'item', input.itemId] }),
        qc.cancelQueries({ queryKey: ['me', 'home'] }),
      ]);
      const prevItem = qc.getQueryData<ItemResponse>(['me', 'item', input.itemId]);
      const prevHome = qc.getQueryData<HomeResponse>(['me', 'home']);

      if (prevItem) {
        const nowIso = new Date().toISOString();
        qc.setQueryData<ItemResponse>(['me', 'item', input.itemId], {
          ...prevItem,
          outcome: input.outcome,
          reflection:
            input.reflection !== undefined
              ? input.reflection.trim() === ''
                ? null
                : input.reflection
              : prevItem.reflection,
          completedAt: input.outcome === 'PENDING' ? null : nowIso,
        });
      }
      if (prevHome) {
        qc.setQueryData<HomeResponse>(
          ['me', 'home'],
          patchHome(prevHome, input.itemId, input.outcome),
        );
      }
      return { prevItem, prevHome };
    },
    onError: (_err, input, ctx) => {
      if (ctx?.prevItem) qc.setQueryData(['me', 'item', input.itemId], ctx.prevItem);
      if (ctx?.prevHome) qc.setQueryData(['me', 'home'], ctx.prevHome);
    },
    onSettled: (_res, _err, input) => {
      qc.invalidateQueries({ queryKey: ['me', 'home'] });
      qc.invalidateQueries({ queryKey: ['me', 'item', input.itemId] });
    },
  });
}
