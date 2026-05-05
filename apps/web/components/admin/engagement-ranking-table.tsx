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
      <span className="block h-6 w-6 overflow-hidden rounded-full bg-paper-warm">
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
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-paper-warm font-sans text-[10px] font-semibold text-ink-soft">
      {initials || '—'}
    </span>
  );
}

export function EngagementRankingTable({ ranking }: EngagementRankingTableProps) {
  if (ranking.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full font-serif-tool tabular-nums text-sm">
        <thead>
          <tr className="border-b-2 border-ink text-left">
            <th className="py-2 pr-2 font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute">##</th>
            <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute">Member</th>
            <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute">Score</th>
            {COLUMN_LABELS.map((c) => (
              <th key={c.key} className="py-2 pr-4 font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute">
                {c.label}
              </th>
            ))}
            <th className="py-2 font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute" aria-label="alert" />
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {ranking.map((row, idx) => (
            <tr key={row.userId} className="group hover:bg-paper-warm">
              <td className="py-2 pr-2 font-mono text-xs text-ink-mute">
                {String(idx + 1).padStart(2, '0')}
              </td>
              <td className="py-2 pr-4">
                <Link
                  href={`/admin/member/${row.userId}`}
                  className="flex items-center gap-2 font-serif font-medium text-ink hover:underline"
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
                  <td key={c.key} className="py-2 pr-4 font-mono text-ink-soft">
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
