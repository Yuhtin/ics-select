const ITEMS: { label: string; cls: string }[] = [
  { label: 'Not yet', cls: 'bg-outcome-pending' },
  { label: 'Nailed it', cls: 'bg-outcome-done-easy' },
  { label: 'Got it (hard)', cls: 'bg-outcome-done-hard' },
  { label: 'Had doubts', cls: 'bg-outcome-doubts' },
  { label: 'Stuck', cls: 'bg-outcome-stuck' },
];

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border-token pt-4 font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
      <span className="font-semibold">Outcomes</span>
      {ITEMS.map(({ label, cls }) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
