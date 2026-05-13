'use client';

const TOTAL = 12;

export function ThermalBar({ pct }: { pct: number }) {
  const filled = Math.max(0, Math.min(TOTAL, Math.round(pct * TOTAL)));
  const empty = TOTAL - filled;
  return (
    <span className="font-mono">
      {'█'.repeat(filled)}
      {'░'.repeat(empty)}
    </span>
  );
}
