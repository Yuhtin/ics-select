import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface SectionLabelProps {
  children: ReactNode;
  className?: string;
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <p
      className={clsx(
        'font-mono text-[9px] uppercase tracking-eyebrow text-ink-mute font-semibold mb-2.5',
        className,
      )}
    >
      {children}
    </p>
  );
}
