'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type MemberDetailResponse = {
  member: {
    id: string;
    name: string;
    email: string;
    pictureUrl: string | null;
    whatsappPhone: string | null;
    track:
      | 'BIG_TECH'
      | 'CONSULTING_TECH'
      | 'COMPETITIVE_PROGRAMMING'
      | 'STARTUP'
      | 'OTHER'
      | null;
    role: 'ADMIN' | 'MEMBER';
  };
  cycle: {
    id: string;
    name: string;
    weekNumber: number;
    weeksTotal: number;
    startsAt: string;
    endsAt: string;
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
  timeline: Array<{
    planId: string;
    weekStart: string;
    weekEnd: string;
    status: 'DRAFT' | 'PUBLISHED';
    items: Array<{
      id: string;
      libraryItemId: string;
      title: string;
      outcome: 'PENDING' | 'DONE_EASY' | 'DONE_HARD' | 'DOUBTS' | 'STUCK' | 'SKIPPED';
      reflection: string | null;
      completedAt: string | null;
      topicLabel: string | null;
    }>;
  }>;
  retros: Array<{
    id: string;
    weekStart: string;
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    submittedAt: string;
  }>;
  planWeeks: {
    current: PlanWeekSlot;
    next: PlanWeekSlot;
  };
};

export type PlanWeekSlot = {
  weekStart: string;
  weekEnd: string;
  inCycle: boolean;
  planId: string | null;
  status: 'DRAFT' | 'PUBLISHED' | null;
};

export function useAdminMember(memberId: string) {
  return useQuery({
    queryKey: ['admin', 'member', memberId],
    queryFn: () => apiFetch<MemberDetailResponse>(`/admin/member/${memberId}`),
  });
}

export function useAdminMemberDiagnose(memberId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'diagnose', memberId],
    queryFn: () =>
      apiFetch<{ markdown: string; cachedAt: string }>(`/members/${memberId}/diagnose`),
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
