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
        'inline-flex items-center rounded-pill px-2 py-0.5 text-[9px] font-bold uppercase tracking-label',
        variant === 'solid' && 'bg-ink text-paper',
        variant === 'soft' && 'bg-paper-warm text-ink',
        variant === 'outline' && 'border border-rule text-ink-mute bg-transparent',
        className,
      )}
    >
      {children}
    </span>
  );
}
