'use client';

import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  iconClassName?: string;
}

export function StatCard({ icon: Icon, label, value, iconClassName = 'text-brand' }: StatCardProps) {
  return (
    <div className="glass rounded-xl p-5 flex items-center gap-4 transition-all duration-200 hover:shadow-md">
      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-brand-soft to-surface-subtle flex items-center justify-center flex-shrink-0">
        <Icon className={`h-5 w-5 ${iconClassName}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        <p className="text-xs text-foreground-muted mt-0.5">{label}</p>
      </div>
    </div>
  );
}
