export function CalendarGridSkeleton() {
  return (
    <div
      className="grid h-[70vh] grid-cols-7 gap-px overflow-hidden rounded-card border border-border-token bg-border-token"
      aria-label="Loading calendar grid"
    >
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="animate-pulse bg-surface-strong/50" />
      ))}
    </div>
  );
}
