'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type CohortEvent = {
  id: string;
  kind: 'finished' | 'got_stuck' | 'had_doubts' | 'posted_retro' | 'started_week';
  at: string;
  member: { id: string; name: string; pictureUrl: string | null };
  itemTitle: string | null;
  itemId: string | null;
};

export type MemberRank = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  score: number;
  isMe: boolean;
};

export type CohortMember = {
  userId: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  isMe: boolean;
};

export type CohortResponse = {
  cycleName: string;
  memberCount: number;
  weekEndsAt: string | null;
  members: CohortMember[];
  feed: CohortEvent[];
  ranking?: MemberRank[];
};

export function useMeCohort() {
  return useQuery({
    queryKey: ['me', 'cohort'],
    queryFn: () => apiFetch<CohortResponse>('/me/cohort'),
    refetchInterval: 60_000,
  });
}
