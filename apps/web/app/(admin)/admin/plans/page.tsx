'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { useAdminCycles } from '../../../../lib/queries/admin-cycles';
import {
  useAdminPlansOverview,
  type PlansOverviewStatus,
} from '../../../../lib/queries/admin-plans-overview';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { formatRelativeFromIso } from '../../../../lib/format/time';

const STATUS_OPTIONS: ReadonlyArray<{ value: PlansOverviewStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
];

function isPlansStatus(v: string | null): v is PlansOverviewStatus {
  return v === 'all' || v === 'draft' || v === 'published';
}

function formatWeekRange(startIso: string, endIso: string): string {
  const start = new Date(startIso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const end = new Date(endIso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `${start} – ${end}`;
}

function PlansPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const cycleId = params.get('cycleId');
  const statusParam = params.get('status');
  const status: PlansOverviewStatus = isPlansStatus(statusParam) ? statusParam : 'all';

  const { data: cycles, isLoading: cyclesLoading } = useAdminCycles();
  const { data, isLoading, error } = useAdminPlansOverview(cycleId, status);

  function update(next: Partial<{ cycleId: string | null; status: PlansOverviewStatus }>) {
    const url = new URLSearchParams(params.toString());
    if ('cycleId' in next) {
      if (next.cycleId) url.set('cycleId', next.cycleId);
      else url.delete('cycleId');
    }
    if ('status' in next && next.status) {
      if (next.status === 'all') url.delete('status');
      else url.set('status', next.status);
    }
    const qs = url.toString();
    router.replace(qs ? `/admin/plans?${qs}` : '/admin/plans', { scroll: false });
  }

  return (
    <div className="max-w-5xl space-y-8">
      <header>
        <Eyebrow>Plans</Eyebrow>
        <h1 className="mt-2 font-serif-tool text-3xl font-semibold tracking-tight">Plans</h1>
        <p className="mt-1 font-mono text-xs text-ink-mute">
          Every plan in a cycle, drafts and published.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="cycle-filter" className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
          Cycle
        </label>
        <select
          id="cycle-filter"
          value={cycleId ?? ''}
          onChange={(e) => update({ cycleId: e.target.value || null })}
          disabled={cyclesLoading}
          className="rounded-input border border-rule bg-paper px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
        >
          <option value="">— Select a cycle —</option>
          {(cycles ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label htmlFor="status-filter" className="ml-4 font-mono text-[10px] uppercase tracking-label text-ink-mute">
          Status
        </label>
        <select
          id="status-filter"
          value={status}
          onChange={(e) => update({ status: e.target.value as PlansOverviewStatus })}
          className="rounded-input border border-rule bg-paper px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {!cycleId ? (
        <p className="font-mono text-xs text-ink-mute py-12 text-center border border-dashed border-rule rounded-card">
          Select a cycle to view its plans.
        </p>
      ) : isLoading ? (
        <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>
      ) : error ? (
        <p className="inline-flex items-center gap-2 rounded-pill bg-outcome-stuck/10 px-3 py-1.5 font-mono text-xs uppercase tracking-label text-outcome-stuck">
          Failed to load · {(error as Error).message}
        </p>
      ) : !data || data.weeks.length === 0 ? (
        <p className="font-mono text-xs text-ink-mute py-12 text-center border border-dashed border-rule rounded-card">
          No plans yet for this cycle.
        </p>
      ) : (
        <div className="space-y-8">
          {data.weeks.map((week) => (
            <section key={week.weekStart}>
              <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                Week of {formatWeekRange(week.weekStart, week.weekEnd)}
              </p>
              <ul className="mt-2 divide-y divide-rule border border-rule rounded-card bg-surface">
                {week.plans.map((plan) => (
                  <li key={plan.id}>
                    <Link
                      href={`/admin/member/${plan.user.id}/plan/${plan.id}`}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-paper-warm/60 transition-colors"
                    >
                      <span className="flex-1 font-serif-tool text-base font-semibold text-ink truncate">
                        {plan.user.name}
                      </span>
                      <span
                        className={clsx(
                          'font-mono text-[10px] uppercase tracking-label px-2 py-0.5 rounded-pill border',
                          plan.status === 'PUBLISHED'
                            ? 'bg-ink/5 text-ink border-ink/20'
                            : 'bg-paper-warm text-ink-mute border-rule',
                        )}
                      >
                        {plan.status}
                      </span>
                      <span className="font-mono text-[11px] text-ink-mute tabular-nums w-24 text-right">
                        {plan.items.done}/{plan.items.total} done
                      </span>
                      <span className="font-mono text-[11px] text-ink-mute w-20 text-right">
                        {formatRelativeFromIso(plan.lastActivityAt)}
                      </span>
                      <span className="font-mono text-xs text-ink-mute">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPlansPage() {
  return (
    <Suspense
      fallback={
        <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>
      }
    >
      <PlansPageInner />
    </Suspense>
  );
}
