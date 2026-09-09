import { AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

type Props = {
  status: 'WATCH' | 'AT_RISK';
  reasons: string[];
};

const STYLES = {
  AT_RISK: { border: 'border-l-danger', bg: 'bg-danger-soft', icon: 'text-danger', label: 'AT RISK' },
  WATCH:   { border: 'border-l-warn', bg: 'bg-warn-soft', icon: 'text-warn', label: 'WATCH' },
} as const;

export function RiskBanner({ status, reasons }: Props) {
  const s = STYLES[status];
  return (
    <div role="status" aria-label="Member risk" className={clsx('rounded-input border border-border-token border-l-[3px] px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2', s.border, s.bg)}>
      <div className="inline-flex shrink-0 items-center gap-2 font-sans text-xs font-semibold text-fg">
        <AlertTriangle aria-hidden="true" className={clsx('w-4 h-4', s.icon)} strokeWidth={2} />
        {s.label}
      </div>
      <div className="min-w-[200px] flex-1 font-sans text-sm text-fg-soft tabular-nums">
        {reasons.join(' · ')}
      </div>
    </div>
  );
}
