'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StudioPageHeader } from '../studio-page-header';

interface CalendarHeaderProps {
  weekStart: Date;
  weekEnd: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  isRefreshing?: boolean;
}

function formatRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
  return `${fmt(start)} – ${fmt(end)}`;
}

export function CalendarHeader({ weekStart, weekEnd, onPrev, onNext, onToday, isRefreshing = false }: CalendarHeaderProps) {
  const controls = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onToday}
        className="min-h-11 rounded-input border border-border-token px-4 font-sans text-sm font-medium text-fg-soft transition-colors hover:bg-bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        Today
      </button>
      <button
        type="button"
        onClick={onPrev}
        className="grid h-11 w-11 place-items-center rounded-input text-fg-soft transition-colors hover:bg-bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={onNext}
        className="grid h-11 w-11 place-items-center rounded-input text-fg-soft transition-colors hover:bg-bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  );

  return (
    <StudioPageHeader
      eyebrow="Weekly planning"
      title={
        <span className="inline-flex flex-wrap items-center gap-3">
          {formatRange(weekStart, weekEnd).replace(' – ', ' to ')}
          {isRefreshing && (
            <span role="status">
              <span aria-hidden className="block h-1.5 w-1.5 animate-pulse rounded-full bg-fg-faint" />
              <span className="sr-only">Refreshing</span>
            </span>
          )}
        </span>
      }
      action={controls}
    />
  );
}
