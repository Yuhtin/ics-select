'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type ReceiptMode = 'thermal' | 'wrapped';

export type ReceiptMember = {
  userId: string;
  name: string;
  pictureUrl: string | null;
};

export type CycleReceiptResponse = {
  cycle: {
    id: string;
    name: string;
    weekNumber: number;
    weeksTotal: number;
    startsAt: string;
    endsAt: string;
    status: 'ACTIVE' | 'ARCHIVED';
  };
  asOf: string;
  mode: ReceiptMode;
  totals: {
    members: number;
    totalMinutes: number;
    avgMinutesPerMember: number;
    itemsCompleted: number;
    retros: number;
    classesHeld: number;
    classesTotal: number;
    attendanceRate: number;
  };
  byTopic: Array<{
    topicId: string;
    slug: string;
    label: string;
    order: number;
    membersReached: number;
    itemsCompleted: number;
    coveragePct: number;
  }>;
  knowledgeGrid: {
    members: ReceiptMember[];
    topics: Array<{ topicId: string; slug: string; label: string; order: number }>;
    cells: Array<{
      userId: string;
      topicId: string;
      itemsDone: number;
      hasStuckOrDoubts: boolean;
    }>;
  };
  topMovers: Array<ReceiptMember & { deltaItems: number; topTopics: string[] }>;
  cycleTopMover: (ReceiptMember & { deltaItems: number; topTopics: string[] }) | null;
  streakChampion: (ReceiptMember & { streakDays: number }) | null;
  engagementLeader: (ReceiptMember & { score: number }) | null;
  mostHoursStudied: (ReceiptMember & { minutes: number }) | null;
  mostItemsCompleted: (ReceiptMember & { items: number }) | null;
  perfectAttendance: ReceiptMember[];
};

export function useCycleReceipt(cycleId: string, asOf?: string) {
  return useQuery<CycleReceiptResponse>({
    queryKey: ['admin-cycle-receipt', cycleId, asOf ?? 'today'],
    queryFn: () =>
      apiFetch(`/admin/cycle/${cycleId}/receipt${asOf ? `?asOf=${asOf}` : ''}`),
    staleTime: 60_000,
  });
}
