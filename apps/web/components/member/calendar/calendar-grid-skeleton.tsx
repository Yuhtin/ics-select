export function CalendarGridSkeleton() {
  return (
    <div className="min-w-0 overflow-x-auto" aria-label="Loading calendar grid">
      <div className="min-w-[840px] overflow-hidden rounded-card border border-border-token">
        <div className="grid h-[68px] grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border-token sm:h-12" aria-hidden>
          <div />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center justify-center">
              <div className="h-4 w-12 animate-pulse rounded bg-bg-subtle" />
            </div>
          ))}
        </div>
        <div className="grid h-[calc(100vh-240px)] grid-cols-[56px_repeat(7,minmax(0,1fr))] divide-x divide-border-token bg-surface" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-bg-subtle/50" />
          ))}
        </div>
      </div>
    </div>
  );
}
