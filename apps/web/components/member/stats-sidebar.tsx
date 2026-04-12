'use client';

import { BookOpen, Clock, Flame } from 'lucide-react';

interface StatsSidebarProps {
  done: number;
  total: number;
  daysRemaining: number;
  streak: number;
}

function RingProgress({ percent, size, strokeWidth }: { percent: number; size: number; strokeWidth: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--surface-subtle))" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--brand))" strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-extrabold text-foreground">{percent}%</span>
      </div>
    </div>
  );
}

export function StatsSidebar({ done, total, daysRemaining, streak }: StatsSidebarProps) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <aside className="hidden lg:flex flex-col gap-4 w-[300px] flex-shrink-0 sticky top-20 self-start">
      <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col items-center">
        <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-4 self-start">
          Progresso Semanal
        </h3>
        <RingProgress percent={percent} size={130} strokeWidth={10} />
      </div>

      <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-soft flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-brand" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{done}/{total}</p>
            <p className="text-xs text-foreground-muted">modulos concluidos</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-warning-soft flex items-center justify-center">
            <Clock className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{daysRemaining}</p>
            <p className="text-xs text-foreground-muted">dias restantes</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-danger-soft flex items-center justify-center">
            <Flame className="h-5 w-5 text-danger" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{streak}</p>
            <p className="text-xs text-foreground-muted">dias consecutivos</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
