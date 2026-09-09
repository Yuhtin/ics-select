'use client';
import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { useAdminCycles } from '../../../../lib/queries/admin-cycles';
import {
  useAdminPlansOverview,
  type PlansOverviewStatus,
} from '../../../../lib/queries/admin-plans-overview';
import { resolveActiveCycleId } from '../../../../lib/cycle/active-cycle';
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

  // When arriving without ?cycleId, auto-select THE active cycle via the
  // shared resolver (current one containing `now`, else nearest upcoming).
  // See apps/web/lib/cycle/active-cycle.ts — must mirror the backend rule
  // documented in CLAUDE.md.
  useEffect(() => {
    if (cycleId) return;
    const activeId = resolveActiveCycleId(cycles);
    if (!activeId) return;
    const url = new URLSearchParams(params.toString());
    url.set('cycleId', activeId);
    router.replace(`/admin/plans?${url.toString()}`, { scroll: false });
  }, [cycleId, cycles, params, router]);

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
        <h1 className="mt-2 font-sans text-3xl font-semibold tracking-tight">Plans</h1>
        <p className="mt-1 font-sans text-xs text-fg-mute">
          Every plan in a cycle, drafts and published.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="cycle-filter" className="font-sans text-xs font-medium text-fg-mute">
          Cycle
        </label>
        <select
          id="cycle-filter"
          value={cycleId ?? ''}
          onChange={(e) => update({ cycleId: e.target.value || null })}
          disabled={cyclesLoading}
          className="min-h-10 rounded-input border border-border-token bg-surface px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">— Select a cycle —</option>
          {(cycles ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label htmlFor="status-filter" className="ml-4 font-sans text-xs font-medium text-fg-mute">
          Status
        </label>
        <select
          id="status-filter"
          value={status}
          onChange={(e) => update({ status: e.target.value as PlansOverviewStatus })}
          className="min-h-10 rounded-input border border-border-token bg-surface px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {!cycleId ? (
        <p className="font-sans text-xs text-fg-mute py-12 text-center border border-dashed border-border-token rounded-card">
          Select a cycle to view its plans.
        </p>
      ) : isLoading ? (
        <p className="font-sans text-xs font-medium text-fg-mute">Loading…</p>
      ) : error ? (
        <p className="inline-flex items-center gap-2 rounded-pill bg-outcome-stuck/10 px-3 py-1.5 font-sans text-xs font-medium text-outcome-stuck">
          Failed to load · {(error as Error).message}
        </p>
      ) : !data || data.weeks.length === 0 ? (
        <p className="font-sans text-xs text-fg-mute py-12 text-center border border-dashed border-border-token rounded-card">
          No plans yet for this cycle.
        </p>
      ) : (
        <div className="space-y-8">
          {data.weeks.map((week) => (
            <section key={week.weekStart}>
              <p className="font-mono text-[10px] uppercase tracking-label text-fg-mute">
                Week of {formatWeekRange(week.weekStart, week.weekEnd)}
              </p>
              <ul className="mt-2 divide-y divide-border-token border border-border-token rounded-card bg-surface">
                {week.plans.map((plan) => (
                  <li key={plan.id}>
                    <Link
                      href={`/admin/member/${plan.user.id}/plan/${plan.id}`}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-bg-subtle/60 transition-colors"
                    >
                      <span className="flex-1 font-sans text-base font-semibold text-fg truncate">
                        {plan.user.name}
                      </span>
                      <span
                        className={clsx(
                          'font-sans text-xs font-medium px-2 py-0.5 rounded-pill border',
                          plan.status === 'PUBLISHED'
                            ? 'bg-fg/5 text-fg border-border-strong/20'
                            : 'bg-bg-subtle text-fg-mute border-border-token',
                        )}
                      >
                        {plan.status}
                      </span>
                      <span className="font-mono text-[11px] text-fg-mute tabular-nums w-24 text-right">
                        {plan.items.done}/{plan.items.total} done
                      </span>
                      <span className="font-mono text-[11px] text-fg-mute w-20 text-right">
                        {formatRelativeFromIso(plan.lastActivityAt)}
                      </span>
                      <span className="font-sans text-xs text-fg-mute">→</span>
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
        <p className="font-sans text-xs font-medium text-fg-mute">Loading…</p>
      }
    >
      <PlansPageInner />
    </Suspense>
  );
}
