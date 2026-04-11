import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-6 pb-8 border-b border-border mb-8">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-foreground mt-1">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-foreground-muted mt-2 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </header>
  );
}
