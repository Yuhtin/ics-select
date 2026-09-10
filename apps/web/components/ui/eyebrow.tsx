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
        'font-sans text-[10px] uppercase tracking-eyebrow text-fg-mute font-semibold',
        className,
      )}
    >
      {children}
    </p>
  );
}
