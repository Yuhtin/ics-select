'use client';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getWaitlistStats, listWaitlist, type WaitlistFilters } from '../waitlist/api';

export function useWaitlistList(filters: WaitlistFilters) {
  return useQuery({
    queryKey: ['waitlist', 'list', filters],
    queryFn: () => listWaitlist(filters),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useWaitlistStats() {
  return useQuery({
    queryKey: ['waitlist', 'stats'],
    queryFn: getWaitlistStats,
    staleTime: 30_000,
  });
}
