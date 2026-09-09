import { CalendarGridSkeleton } from './calendar-grid-skeleton';

export function CalendarSkeleton() {
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]" role="status" aria-label="Loading calendar">
      <div className="space-y-6 border-b border-border-token pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5" aria-hidden>
        <div className="h-3 w-36 animate-pulse rounded bg-bg-subtle" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 border-b border-border-token pb-4">
            <div className="h-3 w-20 animate-pulse rounded bg-bg-subtle" />
            <div className="h-11 animate-pulse rounded bg-bg-subtle" />
          </div>
        ))}
      </div>
      <CalendarGridSkeleton />
    </div>
  );
}
