'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type AiUsageRow = {
  id: string;
  userId: string | null;
  purpose: string;
  model: string;
  promptTokens: number;
  responseTokens: number;
  costUsd: string;
  metadata: unknown;
  createdAt: string;
};

export type AiUsageResponse = {
  rows: AiUsageRow[];
  totalCost: number;
};

export function useAdminAiUsage(sinceDays: number) {
  return useQuery({
    queryKey: ['admin', 'ai-usage', sinceDays],
    queryFn: () =>
      apiFetch<AiUsageResponse>(`/ai/usage?sinceDays=${sinceDays}`),
  });
}
