'use client';

import { useEffect, useState } from 'react';
import { useThemeWithSync } from '../../lib/theme/use-theme-sync';
import { Moon, Sun } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  className?: string;
}

export function ThemeToggle({ className }: Props) {
  const { resolvedTheme, setTheme } = useThemeWithSync();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration flash — render a neutral icon on the server.
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={clsx(
        'inline-flex h-8 w-8 items-center justify-center rounded-input border border-transparent text-fg-mute transition-colors hover:bg-bg-subtle hover:text-fg',
        className,
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4" strokeWidth={1.6} />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={1.6} />
      )}
    </button>
  );
}
