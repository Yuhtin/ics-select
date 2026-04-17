import { clsx } from 'clsx';
import type { ReactNode } from 'react';

type Tone = 'success' | 'primary' | 'warn';

interface ProgressRingProps {
  value: number; // 0..1
  size?: number;
  thickness?: number;
  tone?: Tone;
  label?: string;
  subLabel?: string;
  children?: ReactNode;
  className?: string;
}

const TONE_CLASS: Record<Tone, string> = {
  success: '[--ring-tone:var(--success)]',
  primary: '[--ring-tone:var(--primary)]',
  warn: '[--ring-tone:var(--warn)]',
};

export function ProgressRing({
  value,
  size = 120,
  thickness = 10,
  tone = 'success',
  label,
  subLabel,
  children,
  className,
}: ProgressRingProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;

  return (
    <div
      className={clsx(
        'relative grid place-items-center rounded-full',
        TONE_CLASS[tone],
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(hsl(var(--ring-tone)) ${pct}%, hsl(var(--bg-subtle)) 0)`,
      }}
      role="img"
      aria-label={`${Math.round(pct)}% complete`}
    >
      <div
        aria-hidden="true"
        className="absolute rounded-full bg-surface"
        style={{ inset: thickness }}
      />
      <div className="relative text-center">
        {children ?? (
          <>
            {label && (
              <div className="font-sans text-3xl font-semibold leading-none tracking-tight tabular-nums text-fg">
                {label}
              </div>
            )}
            {subLabel && (
              <div className="mt-1 font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
                {subLabel}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
