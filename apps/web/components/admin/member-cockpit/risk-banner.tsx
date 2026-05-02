import { AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

type Props = {
  status: 'WATCH' | 'AT_RISK';
  reasons: string[];
};

const STYLES = {
  AT_RISK: { border: 'border-stuck', bg: 'bg-stuck/[0.04]', text: 'text-stuck', label: 'AT RISK' },
  WATCH:   { border: 'border-accent', bg: 'bg-accent/[0.04]', text: 'text-accent', label: 'WATCH' },
} as const;

export function RiskBanner({ status, reasons }: Props) {
  const s = STYLES[status];
  return (
    <div className={clsx('border-l-[3px] px-5 py-3 flex items-center gap-5', s.border, s.bg)}>
      <div className={clsx('inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] font-semibold', s.text)}>
        <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} />
        {s.label}
      </div>
      <div className="flex-1 font-mono text-[11px] text-ink-soft tabular-nums">
        {reasons.join(' · ')}
      </div>
    </div>
  );
}
