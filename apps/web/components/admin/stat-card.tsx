'use client';

import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  iconClassName?: string;
}

export function StatCard({ icon: Icon, label, value, iconClassName = 'text-primary' }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-card border border-border-token bg-surface p-5">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-input bg-primary-soft">
        <Icon className={`h-5 w-5 ${iconClassName}`} />
      </div>
      <div>
        <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-fg">{value}</p>
        <p className="mt-0.5 font-sans text-xs text-fg-mute">{label}</p>
      </div>
    </div>
  );
}
