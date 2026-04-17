'use client';

import { useQuery } from '@tanstack/react-query';
import type { ItemOutcome } from '@ics-select/shared';
import { apiFetch } from '../api/client';

export type HomeItem = {
  id: string;
  planId: string;
  order: number;
  title: string;
  format: string;
  estimatedMinutes: number;
  url: string | null;
  topic: { slug: string; label: string } | null;
  outcome: ItemOutcome;
  scheduledAt: string | null;
  scheduledMinutes: number | null;
  carriedFromItemId: string | null;
};

export type CarryOverReflection = {
  itemId: string;
  title: string;
  reflection: string;
  submittedAt: string;
  weekLabel: string;
};

export type TopicCoverage = {
  topicId: string;
  slug: string;
  label: string;
  order: number;
  itemsPlanned: number;
  itemsDone: number;
};

export type HomeResponse = {
  hero:
    | { state: 'now'; item: HomeItem }
    | { state: 'up_next'; item: HomeItem; minutesUntil: number }
    | { state: 'running_late'; item: HomeItem; minutesLate: number }
    | { state: 'all_done'; nextAt: string | null }
    | { state: 'free_day'; nextAt: string | null }
    | null;
  today: HomeItem[];
  days: { label: string; date: string; items: HomeItem[] }[];
  streak: { current: number; last7: boolean[] };
  carryOverReflection: CarryOverReflection | null;
  topicCoverage: TopicCoverage[];
};

export function useMeHome() {
  return useQuery({
    queryKey: ['me', 'home'],
    queryFn: () => apiFetch<HomeResponse>('/me/home'),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}
