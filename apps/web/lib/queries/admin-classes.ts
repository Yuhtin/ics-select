'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';

export type ClassSession = {
  id: string;
  cycleId: string;
  title: string;
  topic: string | null;
  scheduledAt: string;
  durationMin: number;
  notes: string | null;
  attendances?: Array<{ userId: string; status: AttendanceStatus }>;
};

export function useCycleClasses(cycleId: string) {
  return useQuery({
    queryKey: ['admin', 'classes', cycleId],
    queryFn: () => apiFetch<ClassSession[]>(`/cycles/${cycleId}/classes`),
    enabled: Boolean(cycleId),
  });
}

export function useScheduleClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      cycleId: string;
      title: string;
      topic: string | null;
      scheduledAt: string;
      durationMin: number;
      notes?: string;
    }) =>
      apiFetch<ClassSession>(`/cycles/${input.cycleId}/classes`, {
        method: 'POST',
        body: JSON.stringify({
          title: input.title,
          topic: input.topic,
          scheduledAt: input.scheduledAt,
          durationMin: input.durationMin,
          notes: input.notes,
        }),
      }),
    onSuccess: (_res, v) =>
      qc.invalidateQueries({ queryKey: ['admin', 'classes', v.cycleId] }),
  });
}

export function useSubmitAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      cycleId: string;
      classId: string;
      rows: Array<{ userId: string; status: AttendanceStatus }>;
    }) =>
      apiFetch(`/classes/${input.classId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ rows: input.rows }),
      }),
    onSuccess: (_res, v) =>
      qc.invalidateQueries({ queryKey: ['admin', 'classes', v.cycleId] }),
  });
}
