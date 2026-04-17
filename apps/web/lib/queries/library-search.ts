'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type LibraryItem = {
  id: string;
  title: string;
  url?: string | null;
  format: string;
  difficulty: string;
  estimatedMinutes: number;
  tags?: string[];
  tracks?: string[];
  topicId: string | null;
};

export function useLibrarySearch(
  query: string,
  filters?: { tracks?: string[]; topicId?: string },
) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['library-search', trimmed, filters],
    queryFn: () =>
      apiFetch<{ data: LibraryItem[]; total: number }>(`/library/search`, {
        method: 'POST',
        body: JSON.stringify({
          query: trimmed,
          ...(filters?.tracks && filters.tracks.length > 0 ? { tracks: filters.tracks } : {}),
          ...(filters?.topicId ? { topicId: filters.topicId } : {}),
          limit: 20,
        }),
      }),
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  });
}
