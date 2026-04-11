import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: {
    value: string;
    direction: 'up' | 'down';
  };
}

export function StatCard({ icon: Icon, label, value, trend }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-brand-soft text-brand flex items-center justify-center flex-shrink-0">
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          {label}
        </p>
      </div>
      <div className="flex items-end justify-between gap-4 mt-6">
        <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
          {value}
        </p>
        {trend && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              trend.direction === 'up' ? 'text-success' : 'text-danger'
            }`}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden="true" />
            )}
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
