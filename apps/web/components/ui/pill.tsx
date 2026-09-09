import { clsx } from 'clsx';
import type { ReactNode } from 'react';

type PillVariant = 'solid' | 'soft' | 'outline';

interface PillProps {
  children: ReactNode;
  variant?: PillVariant;
  className?: string;
}

export function Pill({ children, variant = 'solid', className }: PillProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-pill px-2 py-1 font-sans text-[10px] font-semibold uppercase tracking-label',
        variant === 'solid' && 'bg-primary text-primary-fg',
        variant === 'soft' && 'bg-surface-strong text-fg',
        variant === 'outline' && 'border border-border-token text-fg-soft bg-transparent',
        className,
      )}
    >
      {children}
    </span>
  );
}
