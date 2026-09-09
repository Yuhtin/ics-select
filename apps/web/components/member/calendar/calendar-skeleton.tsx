export function CalendarSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading calendar">
      <div className="h-10 w-full animate-pulse rounded-card bg-surface-strong/50" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-[60vh] animate-pulse rounded-card bg-surface-strong/50" />
        ))}
      </div>
    </div>
  );
}
