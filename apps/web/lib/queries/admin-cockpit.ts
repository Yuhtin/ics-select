'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type CockpitResponse = {
  member: { id: string; name: string; email: string; pictureUrl: string | null; track: string | null; whatsappPhone: string | null };
  cycle: { id: string; name: string; weekNumber: number; weeksTotal: number; startsAt: string; endsAt: string } | null;
  range: 'cycle' | '7d' | 'all';
  risk: { status: 'ON_TRACK' | 'WATCH' | 'AT_RISK'; reasons: string[] };
  engagement: { score: number; cohortMedian: number; breakdown: Array<{ label: string; value: number; weight: number; status: 'ok' | 'warn' | 'bad' }>; scoreByWeek: number[] };
  itemsCompleted: { total: number; planned: number; completionPct: number; cohortMedian: number; cohortMedianPlanned: number; byOutcome: Record<string, number>; perWeek: Array<{ weekStart: string; byOutcome: Record<string, number> }>; needsAttention: { total: number; stuck: number; doubts: number } };
  timeInvested: { actualMinutes: number; scheduledMinutes: number; cohortMedianMinutes: number; naoSeiCount: number; perWeekMinutes: number[] };
  behavior: {
    sessions:        { value: number; cohortMedian: number; perWeek: number[] };
    daysActive:      { value: number; cycleDays: number; cohortMedian: number; perWeek: number[] };
    daysStudying:    { value: number; cycleDays: number; cohortMedian: number; perWeek: number[] };
    retros:          { submitted: number; expected: number };
    carryOver:       { value: number; cohortMedian: number; perWeek: number[] };
    lastSeen:        { occurredAt: string | null; surface: string | null };
  };
  topicEngagement: Array<{ topicId: string; label: string; minutes: number; pctOfTotal: number; itemsDone: number; itemsPlanned: number; cohortMedianMinutes: number }>;
  classAttendance: { present: number; total: number; cohortPresent: number; sessions: Array<{ scheduledAt: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | null }> };
  firstSession: { occurredAt: string; dayOfCycle: number } | null;
  recentActivity: Array<{ occurredAt: string; type: string; meta: unknown; label: string }>;
};

export function useAdminCockpit(memberId: string, cycleId: string | null, range: 'cycle' | '7d' | 'all' = 'cycle') {
  const params = new URLSearchParams();
  if (cycleId) params.set('cycleId', cycleId);
  params.set('range', range);
  return useQuery<CockpitResponse>({
    queryKey: ['admin-cockpit', memberId, cycleId, range],
    queryFn: async () => apiFetch<CockpitResponse>(`/admin/member/${memberId}/cockpit?${params.toString()}`),
    staleTime: 30_000,
  });
}
