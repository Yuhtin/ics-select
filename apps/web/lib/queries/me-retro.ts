'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type RetroCurrentResponse = {
  open: boolean;
  retro: {
    id: string;
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    submittedAt: string;
  } | null;
  windowOpensAt: string;
  windowClosesAt: string;
};

export function useMeRetroCurrent() {
  return useQuery({
    queryKey: ['me', 'retro', 'current'],
    queryFn: () => apiFetch<RetroCurrentResponse>('/me/retro/current'),
  });
}

export function useSubmitRetro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { whatClicked?: string; whatStuck?: string; nextWeekWish?: string }) =>
      apiFetch<unknown>('/me/retro', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'retro'] }),
  });
}
