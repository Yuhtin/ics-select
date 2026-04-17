'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type AdminLibraryItem = {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  estimatedMinutes: number;
  source: string | null;
  tags: string[];
  tracks: string[];
  topicId: string | null;
  createdAt: string;
};

export function useAdminLibrary() {
  return useQuery({
    queryKey: ['admin', 'library'],
    queryFn: () => apiFetch<AdminLibraryItem[]>('/library'),
  });
}

export function useAdminLibrarySearch(params: {
  query?: string;
  format?: string[];
  difficulty?: string[];
  tracks?: string[];
  topicId?: string;
  maxMinutes?: number;
}) {
  return useQuery({
    queryKey: ['admin', 'library-search', params],
    queryFn: () =>
      apiFetch<{ data: AdminLibraryItem[]; total: number }>('/library/search', {
        method: 'POST',
        body: JSON.stringify({ ...params, limit: 100 }),
      }),
  });
}

type NewLibraryItem = {
  title: string;
  url: string | null;
  description: string | null;
  format: AdminLibraryItem['format'];
  difficulty: AdminLibraryItem['difficulty'];
  estimatedMinutes: number;
  source?: string | null;
  tags?: string[];
};

export function useCreateLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewLibraryItem) =>
      apiFetch<AdminLibraryItem>('/library', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'library'] });
      qc.invalidateQueries({ queryKey: ['admin', 'library-search'] });
    },
  });
}

export function useUpdateLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; data: Partial<NewLibraryItem> }) =>
      apiFetch<AdminLibraryItem>(`/library/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify(input.data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'library'] });
      qc.invalidateQueries({ queryKey: ['admin', 'library-search'] });
    },
  });
}

export function useDeleteLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/library/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'library'] });
      qc.invalidateQueries({ queryKey: ['admin', 'library-search'] });
    },
  });
}

export type ImportedMeta = {
  title?: string;
  description?: string | null;
  format?: AdminLibraryItem['format'];
  estimatedMinutes?: number;
  url?: string;
  source?: string | null;
};

export function useImportUrl() {
  return useMutation({
    mutationFn: (url: string) =>
      apiFetch<ImportedMeta>('/library/import', {
        method: 'POST',
        body: JSON.stringify({ url }),
      }),
  });
}

export type AdminTopicRow = {
  id: string;
  slug: string;
  label: string;
  order: number;
};

export function useCreateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { slug: string; label: string; order?: number }) =>
      apiFetch<AdminTopicRow>('/topics', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['topics'] }),
  });
}

export function useUpdateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      data: { slug?: string; label?: string; order?: number };
    }) =>
      apiFetch<AdminTopicRow>(`/topics/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify(input.data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['topics'] }),
  });
}

export function useDeleteTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/topics/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['topics'] }),
  });
}
