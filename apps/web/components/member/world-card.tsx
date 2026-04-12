'use client';

import { motion } from 'framer-motion';
import { Check, Lock, Zap } from 'lucide-react';

type WorldStatus = 'completed' | 'active' | 'locked';

interface WorldCardProps {
  label: string;
  weekRange: string;
  status: WorldStatus;
  percent: number;
  onClick?: () => void;
}

const STATUS_STYLES: Record<WorldStatus, string> = {
  completed: 'bg-success/5 border-success/30 hover:border-success/60 cursor-pointer',
  active: 'bg-brand/5 border-brand/40 ring-2 ring-brand/20 cursor-pointer',
  locked: 'bg-surface-subtle border-border opacity-60 cursor-not-allowed',
};

export function WorldCard({ label, weekRange, status, percent, onClick }: WorldCardProps) {
  return (
    <motion.button
      type="button"
      onClick={status !== 'locked' ? onClick : undefined}
      disabled={status === 'locked'}
      whileHover={status !== 'locked' ? { scale: 1.03 } : undefined}
      whileTap={status !== 'locked' ? { scale: 0.97 } : undefined}
      className={`flex-shrink-0 w-56 p-5 rounded-2xl border-2 text-left transition-colors ${STATUS_STYLES[status]}`}
    >
      <div className="flex items-center justify-between mb-3">
        {status === 'completed' && <Check className="h-5 w-5 text-success" />}
        {status === 'active' && (
          <span className="bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Zap className="h-3 w-3" /> Agora
          </span>
        )}
        {status === 'locked' && <Lock className="h-5 w-5 text-foreground-subtle" />}
        {status !== 'locked' && (
          <span className="text-xs font-bold text-foreground-muted">{percent}%</span>
        )}
      </div>
      <h3 className="text-sm font-bold text-foreground truncate">{label}</h3>
      <p className="text-xs text-foreground-muted mt-1">{weekRange}</p>
    </motion.button>
  );
}
