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
          aria-hidden
          className={clsx(
            'h-2 w-2 rounded-full',
            variant === 'light' ? 'bg-[#17171b]' : 'bg-[#f4f4f1]',
            variant === 'dark' && 'ring-1 ring-border-token',
          )}
        />
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
          <Check className="h-3 w-3" strokeWidth={2} />
        </span>
      )}
    </button>
  );
}

/**
 * Static SVG mini-preview. Colors are hardcoded so the "Dark" card looks dark
 * even when the site is currently in Light mode (and vice versa).
 */
function ThemePreviewSvg({ variant }: { variant: 'light' | 'dark' }) {
  const palette =
    variant === 'light'
      ? { bg: '#f3f3f1', subtle: '#edeef2', ink: '#17171b', inkSoft: '#46464e', accent: '#2f00ff', rule: '#dadbe2', surface: '#fdfdfc' }
      : { bg: '#101013', subtle: '#17171c', ink: '#f4f4f1', inkSoft: '#a0a0ab', accent: '#7052ff', rule: '#31323a', surface: '#1e1e24' };

  return (
    <svg
      viewBox="0 0 160 96"
      role="img"
      aria-label={`${variant === 'light' ? 'Light' : 'Dark'} theme preview`}
      className="w-full rounded-[6px]"
    >
      <rect width="160" height="96" fill={palette.bg} rx="6" />
      {/* topbar */}
      <rect x="0" y="0" width="160" height="14" fill={palette.subtle} />
      <rect x="8" y="5" width="28" height="4" fill={palette.ink} rx="1" />
      <rect x="144" y="4" width="8" height="6" fill={palette.inkSoft} rx="1" />
      {/* sidebar */}
      <rect x="0" y="14" width="36" height="82" fill={palette.surface} stroke={palette.rule} />
      <rect x="6" y="22" width="22" height="3" fill={palette.inkSoft} rx="1" />
      <rect x="6" y="30" width="18" height="3" fill={palette.inkSoft} rx="1" />
      <rect x="6" y="38" width="22" height="3" fill={palette.accent} rx="1" />
      <rect x="6" y="46" width="14" height="3" fill={palette.inkSoft} rx="1" />
      {/* main card */}
      <rect x="44" y="22" width="108" height="66" fill={palette.surface} stroke={palette.rule} rx="4" />
      <rect x="50" y="30" width="48" height="5" fill={palette.ink} rx="1" />
      <rect x="50" y="40" width="80" height="3" fill={palette.inkSoft} rx="1" />
      <rect x="50" y="46" width="70" height="3" fill={palette.inkSoft} rx="1" />
      {/* list rows */}
      <rect x="50" y="58" width="3" height="8" fill={palette.accent} rx="1" />
      <rect x="57" y="58" width="60" height="3" fill={palette.ink} rx="1" />
      <rect x="57" y="64" width="36" height="2" fill={palette.inkSoft} rx="1" />
      <rect x="50" y="74" width="3" height="8" fill={palette.inkSoft} rx="1" />
      <rect x="57" y="74" width="54" height="3" fill={palette.ink} rx="1" />
      <rect x="57" y="80" width="30" height="2" fill={palette.inkSoft} rx="1" />
    </svg>
  );
}
