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
        'font-sans text-[11px] uppercase tracking-eyebrow text-fg-mute font-semibold mb-3',
        className,
      )}
    >
      {children}
    </p>
  );
}
