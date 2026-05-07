'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type InviteCycle = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
};

export type Invite = {
  id: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  createdAt: string;
  createdBy: { id: string; name: string; email: string } | null;
  cycle: InviteCycle | null;
};

export function useAdminInvites() {
  return useQuery({
    queryKey: ['admin', 'invites'],
    queryFn: () => apiFetch<Invite[]>('/admin/invites'),
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      email: string;
      role: 'ADMIN' | 'MEMBER';
      cycleId?: string;
    }) =>
      apiFetch<Invite>('/admin/invites', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'invites'] }),
  });
}

export function useDeleteInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/invites/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'invites'] }),
  });
}
