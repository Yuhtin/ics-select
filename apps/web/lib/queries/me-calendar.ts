'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ItemOutcome } from '@ics-select/shared';
import { apiFetch } from '../api/client';
import { readCachedWeek, writeCachedWeek } from '../cache/calendar-cache';

export type CalendarEvent = {
  id: string;
  kind: 'ICS' | 'EXTERNAL';
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  meetLink?: string;
  htmlLink?: string;
  ics?: {
    planId: string;
    itemId: string;
    url: string | null;
    format: string;
    topic: { slug: string; label: string } | null;
    outcome: ItemOutcome;
  };
};

export type GetWeekResponse = {
  weekStart: string;
  weekEnd: string;
  timezone: string;
  hasGoogleConnection: boolean;
  events: CalendarEvent[];
};

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useMeCalendarWeek(weekStart: Date) {
  const key = isoDate(weekStart);
  const cached = useMemo(() => readCachedWeek(weekStart), [key]);

  return useQuery({
    queryKey: ['me', 'calendar', key],
    queryFn: async () => {
      const fresh = await apiFetch<GetWeekResponse>(`/me/calendar?weekStart=${key}`);
      writeCachedWeek(weekStart, fresh);
      return fresh;
    },
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.updatedAt,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useRescheduleEvent(weekStart: Date) {
  const qc = useQueryClient();
  const key = ['me', 'calendar', isoDate(weekStart)] as const;
  return useMutation({
    mutationFn: async (input: { eventId: string; start: string; end: string }) => {
      return apiFetch<void>(`/me/calendar/events/${input.eventId}`, {
        method: 'PATCH',
        body: JSON.stringify({ start: input.start, end: input.end }),
      });
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<GetWeekResponse>(key);
      if (previous) {
        qc.setQueryData<GetWeekResponse>(key, {
          ...previous,
          events: previous.events.map((e) =>
            e.id === input.eventId ? { ...e, start: input.start, end: input.end } : e,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: key });
      const fresh = qc.getQueryData<GetWeekResponse>(key);
      if (fresh) writeCachedWeek(weekStart, fresh);
    },
  });
}
