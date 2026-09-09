import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  /** Raised surface or a subtle grouped region (legacy tone name). */
  tone?: 'surface' | 'paper-warm';
  className?: string;
}

export function Card({ children, tone = 'surface', className }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-card border border-border-token text-fg',
        tone === 'surface' && 'bg-surface',
        tone === 'paper-warm' && 'bg-bg-subtle',
        className,
      )}
    >
      {children}
    </div>
  );
}
