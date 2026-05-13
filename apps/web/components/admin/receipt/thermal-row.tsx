'use client';

export function ThermalRow({ label, value }: { label: string; value: string }) {
  const total = 44;
  const lowerLabel = label.toLowerCase();
  const usable = Math.max(0, total - lowerLabel.length - value.length - 2);
  const dots = '.'.repeat(usable);
  return (
    <div className="text-[13px] leading-6">
      <span>{lowerLabel}</span>
      <span className="px-1 text-ink-faint">{dots}</span>
      <span>{value}</span>
    </div>
  );
}
