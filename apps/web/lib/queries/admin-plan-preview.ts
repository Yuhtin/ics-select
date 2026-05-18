'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useDebouncedValue } from '../hooks/use-debounced-value';

export type SchedulingPlacement = {
  itemId: string; // matches WeeklyPlanItem.libraryItemId on the server side
  scheduledAt: string;
  durationMinutes: number;
};

export type SchedulingPreview = {
  placements: SchedulingPlacement[];
  overflow: Array<{ itemId: string; minutesRequired: number }>;
  weekStart: string;
  weekEnd: string;
};

export type PreviewItem = {
  libraryItemId: string;
  order: number;
  estimatedMinutes: number;
};

export function useSchedulingPreview(
  planId: string | null,
  items: PreviewItem[],
  enabled: boolean,
) {
  const debouncedItems = useDebouncedValue(items, 500);
  const hash = useMemo(
    () =>
      debouncedItems
        .map((i) => `${i.libraryItemId}:${i.order}:${i.estimatedMinutes}`)
        .join('|'),
    [debouncedItems],
  );

  return useQuery({
    queryKey: ['plan-preview', planId, hash],
    queryFn: () =>
      apiFetch<SchedulingPreview>(`/plans/${planId}/preview-scheduling`, {
        method: 'POST',
        body: JSON.stringify({ items: debouncedItems }),
      }),
    enabled: Boolean(planId) && planId !== 'new' && enabled,
    placeholderData: (previous) => previous,
  });
}
