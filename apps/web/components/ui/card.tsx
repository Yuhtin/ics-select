import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  /** 'surface' = white / 'paper-warm' = slightly tinted. */
  tone?: 'surface' | 'paper-warm';
  className?: string;
}

export function Card({ children, tone = 'surface', className }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-card border border-rule',
        tone === 'surface' && 'bg-surface',
        tone === 'paper-warm' && 'bg-paper-warm',
        className,
      )}
    >
      {children}
    </div>
  );
}
