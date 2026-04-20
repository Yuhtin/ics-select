// apps/web/components/member/theme-picker.tsx
'use client';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';

interface Props {
  value: 'light' | 'dark';
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
        'group relative flex flex-col gap-3 rounded-tile border text-left transition-all',
        padding,
        active
          ? 'border-primary bg-primary-soft ring-2 ring-primary/30'
          : 'border-border-token bg-surface hover:-translate-y-[1px] hover:border-border-strong',
      )}
    >
      <ThemePreviewSvg variant={variant} />
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={clsx(
            'h-2 w-2 rounded-full',
            variant === 'light' ? 'bg-[#14181F]' : 'bg-[#F1F3F9]',
            variant === 'dark' && 'ring-1 ring-border-token',
          )}
        />
        <span
          className={clsx(
            'font-sans text-sm font-semibold',
            active ? 'text-primary' : 'text-fg',
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
      ? { bg: '#F7F8FA', subtle: '#F1F3F6', ink: '#14181F', inkSoft: '#4B525C', accent: '#4F46E5', rule: '#E4E7EC', surface: '#FFFFFF' }
      : { bg: '#161A23', subtle: '#1C202B', ink: '#F1F3F9', inkSoft: '#9AA0AB', accent: '#7B72F5', rule: '#2A2F3B', surface: '#1F242F' };

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
