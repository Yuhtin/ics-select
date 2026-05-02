'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ItemOutcome } from '@ics-select/shared';
import { apiFetch } from '../api/client';

export type WeekRecapItem = {
  id: string;
  title: string;
  format: string;
  estimatedMinutes: number;
  url: string | null;
  outcome: ItemOutcome;
  order: number;
};

export type WeekRecap = {
  stats: {
    nailed: number;
    hard: number;
    doubts: number;
    stuck: number;
    skipped: number;
    minutesStudied: number;
  };
  items: WeekRecapItem[];
};

export type RetroCurrentResponse = {
  open: boolean;
  retro: {
    id: string;
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    valuedItemId: string | null;
    stuckItemId: string | null;
    submittedAt: string;
  } | null;
  windowOpensAt: string;
  windowClosesAt: string;
  // Optional because the API and web ship through different pipelines
  // (EasyPanel vs Vercel) — the web may briefly load before the API
  // ships the new field. Treat as null when absent.
  weekRecap?: WeekRecap | null;
};

export function useMeRetroCurrent() {
  return useQuery({
    queryKey: ['me', 'retro', 'current'],
    queryFn: () => apiFetch<RetroCurrentResponse>('/me/retro/current'),
  });
}

export type SubmitRetroBody = {
  whatClicked?: string;
  whatStuck?: string;
  nextWeekWish?: string;
  valuedItemId?: string | null;
  stuckItemId?: string | null;
};

export function useSubmitRetro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitRetroBody) =>
      apiFetch<unknown>('/me/retro', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'retro'] }),
  });
}
