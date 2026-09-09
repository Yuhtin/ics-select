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
    <div className="rounded-card border border-border-token bg-surface p-6 text-fg">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-input bg-bg-subtle text-fg-soft flex items-center justify-center flex-shrink-0">
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        </div>
        <p className="font-sans text-xs font-semibold uppercase tracking-label text-fg-mute">
          {label}
        </p>
      </div>
      <div className="flex items-end justify-between gap-4 mt-6">
        <p className="font-mono text-3xl font-semibold tracking-tight text-fg tabular-nums">
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
            <span className="font-mono tabular-nums text-fg-soft">{trend.value}</span>
          </span>
        )}
      </div>
    </div>
  );
}
