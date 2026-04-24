'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type AvailabilitySlot = {
  id?: string;
  dayOfWeek: number;   // 0..6, 0 = Monday
  startMinute: number;
  endMinute: number;
};

export type AvailabilityResponse = {
  mondayMinutes: number | null;
  tuesdayMinutes: number | null;
  wednesdayMinutes: number | null;
  thursdayMinutes: number | null;
  fridayMinutes: number | null;
  saturdayMinutes: number | null;
  sundayMinutes: number | null;
  preferredSessionMinutes: number;
  timezone: string;
  slots: AvailabilitySlot[];
};

export type AvailabilityPatch = Partial<
  Omit<AvailabilityResponse, 'slots'>
> & {
  slots?: AvailabilitySlot[];
  clearDays?: number[];
};

export function useMeAvailability() {
  return useQuery({
    queryKey: ['me', 'availability'],
    queryFn: () => apiFetch<AvailabilityResponse>('/me/availability'),
  });
}

export function useUpdateAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AvailabilityPatch) =>
      apiFetch('/me/availability', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'availability'] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { whatsappPhone?: string | null; targetTrack?: string | null }) =>
      apiFetch('/me/profile', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
