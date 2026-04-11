import type { ReactNode } from 'react';

interface DataTableProps {
  toolbar?: ReactNode;
  children: ReactNode;
}

export function DataTable({ toolbar, children }: DataTableProps) {
  return (
    <div className="rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
      {toolbar && (
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
