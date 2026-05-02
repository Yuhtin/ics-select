'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type PlanContextResponse = {
  member: { id: string; name: string; pictureUrl: string | null; track: string | null };
  cycle: { id: string; name: string; weekNumber: number; weeksTotal: number };
  lastWeek: {
    weekStart: string | null;
    outcomes: {
      done_easy: number;
      done_hard: number;
      doubts: number;
      stuck: number;
      skipped: number;
      pending: number;
    };
    items: Array<{
      id: string;
      libraryItemId: string;
      title: string;
      outcome: 'PENDING' | 'DONE_EASY' | 'DONE_HARD' | 'DOUBTS' | 'STUCK' | 'SKIPPED';
      reflection: string | null;
    }>;
  };
  carryOverCandidates: Array<{
    id: string;
    libraryItemId: string;
    title: string;
    outcome: 'PENDING' | 'DOUBTS' | 'STUCK';
    reflection: string | null;
    topicId: string | null;
    topicLabel: string | null;
    estimatedMinutes: number;
  }>;
  retro: {
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    submittedAt: string;
    valuedItem: { id: string; title: string; outcome: string } | null;
    stuckItem: { id: string; title: string; outcome: string } | null;
  } | null;
  topicCoverage: Array<{
    topicId: string;
    topicSlug: string;
    topicLabel: string;
    order: number;
    itemsPlanned: number;
    itemsDone: number;
    coveragePct: number;
  }>;
  availability: {
    mondayMinutes: number;
    tuesdayMinutes: number;
    wednesdayMinutes: number;
    thursdayMinutes: number;
    fridayMinutes: number;
    saturdayMinutes: number;
    sundayMinutes: number;
    preferredSessionMinutes: number;
    weeklyBudgetMinutes: number;
    timezone: string;
  };
  memberHistory: Array<{
    libraryItemId: string;
    lastOutcome: 'DONE_EASY' | 'DONE_HARD' | 'DOUBTS' | 'STUCK' | 'SKIPPED';
  }>;
};

export function useAdminPlanContext(memberId: string, weekStart: string | null | undefined) {
  return useQuery({
    queryKey: ['admin', 'plan-context', memberId, weekStart],
    queryFn: () =>
      apiFetch<PlanContextResponse>(
        `/admin/member/${memberId}/plan-context?weekStart=${encodeURIComponent(weekStart!)}`,
      ),
    enabled: Boolean(weekStart),
  });
}
