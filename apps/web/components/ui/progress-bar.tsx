import { clsx } from 'clsx';

type Tone = 'default' | 'success' | 'primary' | 'warn' | 'danger';

interface ProgressBarProps {
  value: number; // 0..1
  tone?: Tone;
  className?: string;
  label?: string;
  valueLabel?: string;
}

const TONE_FILL: Record<Tone, string> = {
  default: 'bg-fg',
  success: 'bg-success',
  primary: 'bg-primary',
  warn: 'bg-warn',
  danger: 'bg-danger',
};

export function ProgressBar({
  value,
  tone = 'default',
  className,
  label,
  valueLabel,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={className}>
      {(label || valueLabel) && (
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
          {label && <span>{label}</span>}
          {valueLabel && <span className="tabular-nums">{valueLabel}</span>}
        </div>
      )}
      <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle">
        <div
          className={clsx('h-full rounded-full transition-[width] duration-500', TONE_FILL[tone])}
          style={{
            width: `${pct}%`,
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </div>
  );
}
