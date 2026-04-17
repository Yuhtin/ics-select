'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type AlertType =
  | 'STUCK_RECENT'
  | 'DISAPPEARED'
  | 'STUCK_REPEATEDLY'
  | 'FINISHED_EARLY'
  | 'SKIPPED_RETROS'
  | 'PLAN_PENDING'
  | 'CALENDAR_BROKEN';

export type AlertSeverity = 'urgent' | 'attention' | 'scheduled';

export type TriageAlert = {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  member: {
    id: string;
    name: string;
    pictureUrl: string | null;
    whatsappPhone: string | null;
  };
  targetId: string | null;
  summary: string;
  occurredAt: string;
  dismissKey: string;
};

export type CohortStripEntry = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  percentThisWeek: number;
  hasAlert: boolean;
};

export type CycleInfo = {
  cycleId: string;
  cycleName: string;
  weekNumber: number; // 0 when the cycle hasn't started yet
  weeksTotal: number;
  daysUntilWeekEnds: number;
  hasStarted: boolean;
  daysUntilStart: number; // 0 once the cycle is running
};

export type TriageResponse = {
  alerts: TriageAlert[];
  cohortStrip: CohortStripEntry[];
  cycleInfo: CycleInfo | null;
};

export function useAdminTriage() {
  return useQuery({
    queryKey: ['admin', 'triage'],
    queryFn: () => apiFetch<TriageResponse>('/admin/triage'),
    refetchInterval: 60_000,
  });
}

export function useDismissAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { alertType: AlertType; targetId: string }) =>
      apiFetch<unknown>('/admin/alerts/dismiss', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'triage'] }),
  });
}
