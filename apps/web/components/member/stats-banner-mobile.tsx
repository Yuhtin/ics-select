'use client';

import { BookOpen, Clock, Flame } from 'lucide-react';

interface StatsBannerMobileProps {
  done: number;
  total: number;
  daysRemaining: number;
  streak: number;
}

export function StatsBannerMobile({ done, total, daysRemaining, streak }: StatsBannerMobileProps) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="lg:hidden flex items-center gap-4 px-4 py-3 bg-surface/80 backdrop-blur-sm border-b border-border/40 overflow-x-auto">
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="h-8 w-8 rounded-full border-2 border-brand flex items-center justify-center">
          <span className="text-xs font-bold text-brand">{percent}%</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-foreground-muted">
        <BookOpen className="h-3.5 w-3.5" />
        <span className="font-medium">{done}/{total}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-foreground-muted">
        <Clock className="h-3.5 w-3.5" />
        <span className="font-medium">{daysRemaining}d</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-foreground-muted">
        <Flame className="h-3.5 w-3.5" />
        <span className="font-medium">{streak}</span>
      </div>
    </div>
  );
}
