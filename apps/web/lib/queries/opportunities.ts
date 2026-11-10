'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  OpportunityInput,
  OpportunityStatus,
  OpportunityType,
  WorkMode,
} from '@ics-select/shared';
import { apiFetch } from '../api/client';

export type OpportunityDto = {
  id: string;
  title: string;
  type: OpportunityType;
  companyName: string;
  description: string | null;
  location: string | null;
  workMode: WorkMode | null;
  compensation: string | null;
  deadline: string | null;
  eventDate: string | null;
  links: { label: string; url: string }[];
  contacts: { name: string; role?: string; whatsapp?: string; email?: string; linkedin?: string }[];
  status: OpportunityStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isOpen: boolean;
  createdBy: { id: string; name: string; role: 'ADMIN' | 'MEMBER' };
  interests: { userId: string; name: string; pictureUrl: string | null; createdAt: string }[];
  interestedByMe: boolean;
};

export function useOpportunities(opts?: { interestedBy?: string }) {
  const qs = opts?.interestedBy ? `?interestedBy=${encodeURIComponent(opts.interestedBy)}` : '';
  return useQuery({
    queryKey: ['opportunities', opts],
    queryFn: () => apiFetch<OpportunityDto[]>(`/opportunities${qs}`),
  });
}

type Me = { id: string; name: string; pictureUrl: string | null };

export function useSetInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) =>
      apiFetch<{ ok: true }>(`/opportunities/${id}/interest`, { method: on ? 'PUT' : 'DELETE' }),
    onMutate: async ({ id, on }) => {
      await qc.cancelQueries({ queryKey: ['opportunities'] });
      const snapshot = qc.getQueriesData<OpportunityDto[]>({ queryKey: ['opportunities'] });
      const me = qc.getQueryData<Me>(['me']);
      qc.setQueriesData<OpportunityDto[]>({ queryKey: ['opportunities'] }, (list) =>
        list?.map((o) => {
          if (o.id !== id) return o;
          const others = o.interests.filter((i) => i.userId !== me?.id);
          const interests = on && me
            ? [...others, { userId: me.id, name: me.name, pictureUrl: me.pictureUrl, createdAt: new Date().toISOString() }]
            : others;
          return { ...o, interestedByMe: on, interests };
        }),
      );
      return { snapshot };
    },
    onError: (_e, _v, ctx) => ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['opportunities'] }),
  });
}

export function useSaveOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: Partial<OpportunityInput> }) =>
      apiFetch<OpportunityDto>(id ? `/opportunities/${id}` : '/opportunities', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['opportunities'] }),
  });
}

export function useDeleteOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/opportunities/${id}`, { method: 'DELETE' }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['opportunities'] }),
  });
}
