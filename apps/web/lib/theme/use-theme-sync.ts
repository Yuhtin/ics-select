'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '../auth/auth-context';
import { useUpdateTheme } from '../queries/me-theme';

export function useThemeWithSync() {
  const { resolvedTheme, setTheme } = useTheme();
  const { mutate } = useUpdateTheme();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const setAndPersist = useCallback(
    (next: 'light' | 'dark') => {
      setTheme(next);
      if (user) {
        mutate(
          { themePreference: next.toUpperCase() as 'LIGHT' | 'DARK' },
          {
            onError: (err) => {
              console.warn('[theme] failed to persist preference', err);
            },
          },
        );
      }
    },
    [setTheme, mutate, user],
  );

  return { resolvedTheme, setTheme: setAndPersist, mounted };
}
