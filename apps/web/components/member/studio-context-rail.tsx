import { clsx } from 'clsx';
import type { ReactNode } from 'react';

export function StudioContextRail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <aside data-testid="studio-context-rail" className={clsx('min-w-0 border-t border-border-token pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0', className)}>
      <div className="divide-y divide-border-token">{children}</div>
    </aside>
  );
}
