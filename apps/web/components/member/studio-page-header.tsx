import { clsx } from 'clsx';
import type { ReactNode } from 'react';

export interface StudioPageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function StudioPageHeader({ eyebrow, title, description, action, className }: StudioPageHeaderProps) {
  return (
    <header className={clsx('flex flex-wrap items-end justify-between gap-5 border-b border-border-token pb-6', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="font-mono text-[11px] uppercase tracking-label text-fg-mute">{eyebrow}</p>}
        <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-0.045em] text-fg sm:text-[40px]">{title}</h1>
        {description && <p className="mt-3 max-w-prose font-sans text-sm leading-relaxed text-fg-soft">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
