import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <p
      className={clsx(
        'font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold',
        className,
      )}
    >
      {children}
    </p>
  );
}
