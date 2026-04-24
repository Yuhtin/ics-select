'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ThemePreference } from '@ics-select/shared';
import { apiFetch } from '../api/client';

export function useUpdateTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['me', 'theme'],
    mutationFn: (input: { themePreference: ThemePreference }) =>
      apiFetch('/me/theme', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
