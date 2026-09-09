'use client';
import { Fragment } from 'react';
import { clsx } from 'clsx';
import type {
  CycleOverviewHeatmapRow,
  CycleOverviewHeatmapWeek,
} from '../../lib/queries/admin-cycle';

function cellShade(v: number): string {
  if (v === 0) return 'bg-bg-subtle';
  if (v <= 25) return 'bg-primary/20';
  if (v <= 50) return 'bg-primary/40';
  if (v <= 80) return 'bg-primary/70';
  return 'bg-primary';
}

export function CohortHeatmap({
  weeks,
  rows,
}: {
  weeks: CycleOverviewHeatmapWeek[];
  rows: CycleOverviewHeatmapRow[];
}) {
  if (rows.length === 0) {
    return <p className="font-sans text-xs text-fg-mute">No data yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-card border border-border-token bg-surface p-4">
      <div
        className="inline-grid gap-y-2 gap-x-2"
        style={{
          gridTemplateColumns: `minmax(140px, auto) repeat(${weeks.length}, 28px)`,
        }}
      >
        {/* Header row */}
        <div />
        {weeks.map((w) => (
          <div
            key={w.index}
            className="font-mono text-[10px] text-fg-mute text-center"
          >
            {w.label}
          </div>
        ))}
        {/* Data rows */}
        {rows.map((row) => (
          <Fragment key={row.userId}>
            <div className="font-sans text-sm font-semibold text-fg truncate pr-2 self-center">
              {row.name}
            </div>
            {row.cells.map((value, idx) => (
              <div
                key={idx}
                title={`${weeks[idx]?.label ?? ''} · ${value}%`}
                className={clsx(
                  'h-7 w-7 rounded-sm border border-border-token',
                  cellShade(value),
                )}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
