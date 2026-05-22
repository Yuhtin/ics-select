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
  skippable: boolean;
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

export type StudyTimeSummary = {
  actualMinutes: number;
  estimatedMinutes: number;
  itemsWithTime: number;
  itemsTotal: number;
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
  /** Overdue PENDING items from prior days within the current week's plan.
   *  Optional for the same reason as `unscheduled` — the API + web ship
   *  through different pipelines, so a frontend build may run against an
   *  older API. Treat as [] when absent. */
  late?: HomeItem[];
  days: { label: string; date: string; items: HomeItem[] }[];
  // Optional because API + web ship through different pipelines (EasyPanel
  // vs Vercel), so the frontend may load a build that expects this field
  // before the backend ships it. Treat as [] when absent.
  unscheduled?: HomeItem[];
  streak: { current: number; last7: boolean[] };
  carryOverReflection: CarryOverReflection | null;
  topicCoverage: TopicCoverage[];
  /** Optional because API + web ship through different pipelines. Treat
   *  as null when absent (older backend). */
  studyTime?: StudyTimeSummary | null;
};

export function useMeHome() {
  return useQuery({
    queryKey: ['me', 'home'],
    queryFn: () => apiFetch<HomeResponse>('/me/home'),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}
