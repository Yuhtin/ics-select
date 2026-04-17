'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type Topic = {
  id: string;
  slug: string;
  label: string;
  order: number;
};

export function useTopics() {
  return useQuery({
    queryKey: ['topics'],
    queryFn: () => apiFetch<Topic[]>('/topics'),
  });
}
