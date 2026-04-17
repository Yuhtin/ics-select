'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type AdminNote = {
  id: string;
  aboutId: string;
  authorId: string;
  text: string;
  createdAt: string;
};

export function useAdminNotes(aboutId: string | null | undefined) {
  return useQuery({
    queryKey: ['admin', 'notes', aboutId],
    queryFn: () => apiFetch<AdminNote[]>(`/admin/notes?aboutId=${aboutId}`),
    enabled: Boolean(aboutId),
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { aboutId: string; text: string }) =>
      apiFetch<AdminNote>('/admin/notes', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_note, v) =>
      qc.invalidateQueries({ queryKey: ['admin', 'notes', v.aboutId] }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; aboutId: string; text: string }) =>
      apiFetch<AdminNote>(`/admin/notes/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ text: input.text }),
      }),
    onSuccess: (_note, v) =>
      qc.invalidateQueries({ queryKey: ['admin', 'notes', v.aboutId] }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; aboutId: string }) =>
      apiFetch<{ ok: boolean }>(`/admin/notes/${input.id}`, { method: 'DELETE' }),
    onSuccess: (_ok, v) =>
      qc.invalidateQueries({ queryKey: ['admin', 'notes', v.aboutId] }),
  });
}
