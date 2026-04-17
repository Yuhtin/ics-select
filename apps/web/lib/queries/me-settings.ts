'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type AvailabilityResponse = {
  mondayMinutes: number;
  tuesdayMinutes: number;
  wednesdayMinutes: number;
  thursdayMinutes: number;
  fridayMinutes: number;
  saturdayMinutes: number;
  sundayMinutes: number;
  preferredSessionMinutes: number;
  timezone: string;
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
    mutationFn: (input: Partial<AvailabilityResponse>) =>
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
