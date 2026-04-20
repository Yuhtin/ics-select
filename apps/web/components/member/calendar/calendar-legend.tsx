const ITEMS: { label: string; cls: string }[] = [
  { label: 'Not yet', cls: 'bg-outcome-pending' },
  { label: 'Nailed it', cls: 'bg-outcome-done-easy' },
  { label: 'Got it (hard)', cls: 'bg-outcome-done-hard' },
  { label: 'Had doubts', cls: 'bg-outcome-doubts' },
  { label: 'Stuck', cls: 'bg-outcome-stuck' },
];

export function CalendarLegend() {
  return (
    <details className="border-t border-border-token pt-4 font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <span className="font-semibold">Outcomes</span>
        <span className="flex items-center gap-1">
          {ITEMS.map(({ label, cls }) => (
            <span key={label} className={`inline-block h-2 w-2 rounded-full ${cls}`} aria-hidden />
          ))}
        </span>
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {ITEMS.map(({ label, cls }) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />
            {label}
          </span>
        ))}
      </div>
    </details>
  );
}
