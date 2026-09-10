// apps/web/components/member/theme-picker.tsx
'use client';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';

interface Props {
  /** Current theme. Pass nullish (e.g. before next-themes hydrates) to show no selection. */
  value: 'light' | 'dark' | null | undefined;
  onChange: (next: 'light' | 'dark') => void;
  /** Minor padding/sizing variation between onboarding and settings. */
  size?: 'onboarding' | 'settings';
}

export function ThemePicker({ value, onChange, size = 'onboarding' }: Props) {
  const padding = size === 'settings' ? 'p-3' : 'p-4';
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ThemeCard
        variant="light"
        active={value === 'light'}
        onClick={() => onChange('light')}
        padding={padding}
      />
      <ThemeCard
        variant="dark"
        active={value === 'dark'}
        onClick={() => onChange('dark')}
        padding={padding}
      />
    </div>
  );
}

interface CardProps {
  variant: 'light' | 'dark';
  active: boolean;
  onClick: () => void;
  padding: string;
}

function ThemeCard({ variant, active, onClick, padding }: CardProps) {
  const label = variant === 'light' ? 'Light' : 'Dark';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'group relative flex flex-col gap-3 rounded-card border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        padding,
        active
          ? 'border-primary bg-primary-soft'
          : 'border-border-token bg-surface hover:border-border-strong hover:bg-surface-hover',
      )}
    >
      <ThemePreviewSvg variant={variant} />
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            'font-sans text-sm font-semibold',
            active ? 'text-primary dark:text-primary-fg' : 'text-fg',
          )}
        >
          {label}
        </span>
      </div>
      {active && (
        <span
          className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-fg"
          aria-hidden
        >
          <Check className="h-3 w-3" strokeWidth={1.5} />
        </span>
      )}
    </button>
  );
}

/** Scope the Academy tokens so each preview keeps its own theme. */
function ThemePreviewSvg({ variant }: { variant: 'light' | 'dark' }) {
  return (
    <svg
      data-theme={variant}
      viewBox="0 0 160 96"
      role="img"
      aria-label={`${variant === 'light' ? 'Light' : 'Dark'} theme preview`}
      className="w-full overflow-hidden rounded-[6px]"
    >
      <rect width="160" height="96" fill="hsl(var(--bg))" />
      <rect width="22" height="96" fill="hsl(var(--member-rail-bg))" />
      <rect x="7" y="9" width="8" height="5" fill="hsl(var(--member-rail-fg))" rx="1" />
      <rect x="4" y="23" width="14" height="13" fill="hsl(var(--primary))" rx="2" />
      <path d="M8 29H14M8 43H14M8 54H14M8 82H14" stroke="hsl(var(--member-rail-fg))" strokeWidth="2" />
      <rect x="32" y="11" width="54" height="5" fill="hsl(var(--fg))" rx="1" />
      <path d="M32 23H150M32 63H150M32 79H150" stroke="hsl(var(--border))" />
      <rect x="32" y="32" width="2" height="23" fill="hsl(var(--primary))" />
      <rect x="40" y="33" width="65" height="4" fill="hsl(var(--fg))" rx="1" />
      <rect x="40" y="41" width="48" height="2" fill="hsl(var(--fg-mute))" rx="1" />
      <rect x="40" y="48" width="25" height="6" fill="hsl(var(--primary))" rx="2" />
      <path d="M32 70H43M32 86H43" stroke="hsl(var(--fg-mute))" strokeWidth="2" />
      <path d="M50 70H119M50 86H102" stroke="hsl(var(--fg-soft))" strokeWidth="3" />
    </svg>
  );
}
