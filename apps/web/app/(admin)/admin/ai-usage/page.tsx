'use client';
import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { useAdminAiUsage, type AiUsageRow } from '../../../../lib/queries/admin-ai-usage';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { SectionLabel } from '../../../../components/ui/section-label';

type Range = 7 | 30 | 90;

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatUsd(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

function groupByDay(rows: AiUsageRow[]): Array<{ date: string; cost: number; calls: number }> {
  const map = new Map<string, { date: string; cost: number; calls: number }>();
  for (const r of rows) {
    const d = new Date(r.createdAt);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const cur = map.get(key) ?? { date: key, cost: 0, calls: 0 };
    cur.cost += Number(r.costUsd);
    cur.calls += 1;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export default function AdminAiUsagePage() {
  const [range, setRange] = useState<Range>(30);
  const { data, isLoading } = useAdminAiUsage(range);

  const rows = data?.rows ?? [];
  const totalCost = data?.totalCost ?? 0;

  const totalTokens = useMemo(
    () =>
      rows.reduce((s, r) => s + r.promptTokens + r.responseTokens, 0),
    [rows],
  );

  const daily = useMemo(() => groupByDay(rows), [rows]);
  const maxDailyCost = Math.max(0.0001, ...daily.map((d) => d.cost));

  return (
    <div className="max-w-5xl space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Eyebrow>AI usage</Eyebrow>
          <h1 className="mt-2 font-serif-tool text-3xl font-semibold tracking-tight">
            AI usage
          </h1>
        </div>
        <nav className="flex gap-1 rounded-pill border border-rule bg-paper p-1">
          {([7, 30, 90] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={clsx(
                'font-mono text-xs uppercase tracking-label px-3 py-1 rounded-pill transition-colors',
                range === r
                  ? 'bg-ink text-paper'
                  : 'text-ink-soft hover:bg-paper-warm',
              )}
            >
              {r}d
            </button>
          ))}
        </nav>
      </header>

      {isLoading ? (
        <p className="font-mono text-xs uppercase tracking-label text-ink-mute">
          Loading…
        </p>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-4">
            <StatCard label={`Cost · ${range}d`} value={formatUsd(totalCost)} />
            <StatCard label="Tokens" value={totalTokens.toLocaleString('en-US')} />
            <StatCard label="Calls" value={rows.length.toLocaleString('en-US')} />
          </section>

          <section>
            <SectionLabel>Daily cost</SectionLabel>
            {daily.length === 0 ? (
              <p className="mt-3 font-mono text-xs text-ink-mute py-8 text-center border border-dashed border-rule rounded-card">
                No usage yet in this range.
              </p>
            ) : (
              <div className="mt-3 flex items-end gap-1 h-32 border-b border-rule">
                {daily.map((d) => {
                  const hPct = Math.max(2, (d.cost / maxDailyCost) * 100);
                  return (
                    <div
                      key={d.date}
                      className="flex-1 flex flex-col justify-end items-center group relative"
                    >
                      <div
                        className="w-full bg-ink/70 hover:bg-ink transition-colors"
                        style={{ height: `${hPct}%` }}
                        title={`${formatDay(d.date)} · ${formatUsd(d.cost)} · ${d.calls} calls`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            {daily.length > 0 && (
              <div className="mt-2 flex gap-1">
                {daily.map((d, idx) => (
                  <span
                    key={d.date}
                    className={clsx(
                      'flex-1 text-center font-mono text-[9px] uppercase tracking-label text-ink-mute',
                      idx % Math.max(1, Math.floor(daily.length / 8)) !== 0 && 'invisible',
                    )}
                  >
                    {formatDay(d.date)}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionLabel>Usage · {rows.length} calls</SectionLabel>
            {rows.length === 0 ? (
              <p className="mt-3 font-mono text-xs text-ink-mute py-8 text-center border border-dashed border-rule rounded-card">
                No usage yet.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto border border-rule rounded-card bg-surface">
                <table className="w-full text-sm">
                  <thead className="bg-paper-warm">
                    <tr className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                      <th className="text-left px-4 py-2">When</th>
                      <th className="text-left px-4 py-2">Purpose</th>
                      <th className="text-left px-4 py-2">Model</th>
                      <th className="text-right px-4 py-2">Prompt</th>
                      <th className="text-right px-4 py-2">Response</th>
                      <th className="text-right px-4 py-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {rows.slice(0, 50).map((r) => (
                      <tr key={r.id} className="hover:bg-paper-warm/50">
                        <td className="px-4 py-2 font-mono text-xs text-ink-mute">
                          {formatDay(r.createdAt)}
                        </td>
                        <td className="px-4 py-2 font-sans text-sm text-ink">
                          {r.purpose}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-ink-soft">
                          {r.model}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-ink-mute">
                          {r.promptTokens.toLocaleString('en-US')}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-ink-mute">
                          {r.responseTokens.toLocaleString('en-US')}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-ink">
                          {formatUsd(Number(r.costUsd))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && (
                  <p className="px-4 py-2 font-mono text-[10px] uppercase tracking-label text-ink-mute border-t border-rule">
                    Showing first 50 of {rows.length}
                  </p>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-rule rounded-card bg-surface px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold">
        {label}
      </p>
      <p className="mt-2 font-serif-tool text-3xl font-semibold tabular-nums text-ink">
        {value}
      </p>
    </div>
  );
}
