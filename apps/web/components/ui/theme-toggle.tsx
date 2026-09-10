'use client';

import { useThemeWithSync } from '../../lib/theme/use-theme-sync';
import { Moon, Sun } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  className?: string;
  presentation?: 'default' | 'rail';
}

export function ThemeToggle({ className, presentation = 'default' }: Props) {
  const { resolvedTheme, setTheme, mounted } = useThemeWithSync();
  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={clsx(
        presentation === 'default' &&
          'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-input border border-border-token bg-surface text-fg-mute transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        presentation === 'rail' &&
          'text-[hsl(var(--member-rail-fg))] hover:bg-[hsl(var(--member-rail-hover))] hover:text-primary-fg',
        className,
      )}
    >
      {isDark ? (
        <Sun aria-hidden className="h-4 w-4" strokeWidth={1.5} />
      ) : (
        <Moon aria-hidden className="h-4 w-4" strokeWidth={1.5} />
      )}
      {presentation === 'rail' && <span>Theme</span>}
    </button>
  );
}
