'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type AdminMemberCard = {
  id: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
  stats: {
    plansCount: number;
    doneItems: number;
    skippedItems: number;
    stuckItems: number;
  };
};

export function useAdminMembers() {
  return useQuery({
    queryKey: ['admin', 'members'],
    queryFn: () => apiFetch<AdminMemberCard[]>('/admin/dashboard'),
  });
}
