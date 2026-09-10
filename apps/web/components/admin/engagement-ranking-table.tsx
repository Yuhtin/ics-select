'use client';
import Link from 'next/link';
import { clsx } from 'clsx';
import { AlertTriangle } from 'lucide-react';
import type { EngagementRankingRow } from '../../lib/queries/admin-cycle';

interface EngagementRankingTableProps {
  ranking: EngagementRankingRow[];
}

// keys must match ScoreBreakdownEntry.label in apps/api/src/admin/cockpit/engagement-score.ts
const COLUMN_LABELS: Array<{ key: string; label: string }> = [
  { key: 'Cohort rank',        label: 'COHORT' },
  { key: 'Days active',        label: 'ACTIVE' },
  { key: 'Plan completion',    label: 'COMPL' },
  { key: 'Retros submitted',   label: 'RETRO' },
  { key: 'Class attendance',   label: 'CLASS' },
  { key: 'Recency',            label: 'RECEN' },
];

function scoreColor(score: number): string {
  if (score >= 66) return 'text-outcome-done-easy';
  if (score >= 33) return 'text-outcome-done-hard';
  return 'text-outcome-stuck';
}

function Avatar({ name, pictureUrl }: { name: string; pictureUrl: string | null }) {
  if (pictureUrl) {
    return (
      <span className="block h-6 w-6 overflow-hidden rounded-full bg-bg-subtle">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pictureUrl} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-bg-subtle font-sans text-[10px] font-semibold text-fg-soft">
      {initials || '—'}
    </span>
  );
}

export function EngagementRankingTable({ ranking }: EngagementRankingTableProps) {
  if (ranking.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-card border border-border-token bg-surface px-4">
      <table className="w-full min-w-[600px] font-sans tabular-nums text-sm">
        <thead>
          <tr className="border-b border-border-token text-left">
            <th className="py-2 pr-2 font-sans text-xs font-medium text-fg-mute">##</th>
            <th className="py-2 pr-4 font-sans text-xs font-medium text-fg-mute">Member</th>
            <th className="py-2 pr-4 font-sans text-xs font-medium text-fg-mute">Score</th>
            {COLUMN_LABELS.map((c) => (
              <th key={c.key} className="py-2 pr-4 font-sans text-xs font-medium text-fg-mute">
                {c.label}
              </th>
            ))}
            <th className="py-2 font-sans text-xs font-medium text-fg-mute" aria-label="alert" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border-token">
          {ranking.map((row, idx) => (
            <tr key={row.userId} className="group hover:bg-bg-subtle">
              <td className="py-2 pr-2 font-mono text-xs text-fg-mute">
                {String(idx + 1).padStart(2, '0')}
              </td>
              <td className="py-2 pr-4">
                <Link
                  href={`/admin/member/${row.userId}`}
                  className="flex items-center gap-2 font-sans font-medium text-fg hover:underline"
                >
                  <Avatar name={row.name} pictureUrl={row.pictureUrl} />
                  {row.name}
                </Link>
              </td>
              <td className={clsx('py-2 pr-4 font-mono', scoreColor(row.score))}>
                {row.score}/100
              </td>
              {COLUMN_LABELS.map((c) => {
                const entry = row.breakdown.find((b) => b.label === c.key);
                return (
                  <td key={c.key} className="py-2 pr-4 font-mono text-fg-soft">
                    {entry ? entry.value : 0}
                  </td>
                );
              })}
              <td className="py-2">
                {row.hasAlert && (
                  <AlertTriangle
                    className="h-3.5 w-3.5 text-outcome-stuck"
                    strokeWidth={1.5}
                    aria-label="Has alert"
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
