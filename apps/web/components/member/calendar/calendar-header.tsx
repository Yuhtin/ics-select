'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarHeaderProps {
  weekStart: Date;
  weekEnd: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function formatRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
  return `${fmt(start)} – ${fmt(end)}`;
}

export function CalendarHeader({ weekStart, weekEnd, onPrev, onNext, onToday }: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border-token pb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="grid h-8 w-8 place-items-center rounded-input text-fg-soft transition-colors hover:bg-bg-subtle hover:text-fg"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <span className="font-serif text-xl font-medium tabular-nums text-fg">
          {formatRange(weekStart, weekEnd)}
        </span>
        <button
          type="button"
          onClick={onNext}
          className="grid h-8 w-8 place-items-center rounded-input text-fg-soft transition-colors hover:bg-bg-subtle hover:text-fg"
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
      <button
        type="button"
        onClick={onToday}
        className="rounded-input border border-border-token px-3 py-1 font-sans text-sm font-medium text-fg-soft transition-colors hover:bg-bg-subtle hover:text-fg"
      >
        Today
      </button>
    </div>
  );
}
