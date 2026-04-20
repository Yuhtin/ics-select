'use client';
import { useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '../auth/auth-context';
import { useUpdateTheme } from '../queries/me-theme';

export function useThemeWithSync() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const update = useUpdateTheme();
  const { user } = useAuth();

  const setAndPersist = useCallback(
    (next: 'light' | 'dark') => {
      setTheme(next);
      if (user) {
        update.mutate(
          { themePreference: next.toUpperCase() as 'LIGHT' | 'DARK' },
          {
            onError: (err) => {
              console.warn('[theme] failed to persist preference', err);
            },
          },
        );
      }
    },
    [setTheme, update, user],
  );

  return { theme, resolvedTheme, setTheme: setAndPersist, isPending: update.isPending };
}
