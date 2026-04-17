'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

// Availability already has an existing hook elsewhere; add only the profile hook.
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { whatsappPhone?: string | null; targetTrack?: string | null }) =>
      apiFetch('/me/profile', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
