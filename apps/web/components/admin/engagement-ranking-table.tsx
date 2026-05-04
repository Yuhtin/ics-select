'use client';
import Link from 'next/link';
import { clsx } from 'clsx';
import type { EngagementRankingRow } from '../../lib/queries/admin-cycle';

interface EngagementRankingTableProps {
  ranking: EngagementRankingRow[];
}

const COLUMN_LABELS: Array<{ key: string; label: string }> = [
  { key: 'Cohort rank',        label: 'COHORT' },
  { key: 'Days active',        label: 'ACTIVE' },
  { key: 'Plan completion',    label: 'COMPL' },
  { key: 'Retros submitted',   label: 'RETRO' },
  { key: 'Time to first view', label: 'TTFV' },
  { key: 'Recency',            label: 'RECEN' },
];

function scoreColor(score: number): string {
  if (score >= 66) return 'text-done-easy';
  if (score >= 33) return 'text-done-hard';
  return 'text-stuck';
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
                  <span className="block h-6 w-6 overflow-hidden rounded-full bg-paper-warm">
                    {row.pictureUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.pictureUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
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
              <td className="py-2 font-mono text-stuck">
                {row.hasAlert ? '⚠' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
