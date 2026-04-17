'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, Archive } from 'lucide-react';
import { clsx } from 'clsx';
import {
  useAdminCycles,
  useArchiveCycle,
  type CycleRow,
} from '../../../../lib/queries/admin-cycles';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { NewCycleModal } from '../../../../components/admin/cycles/new-cycle-modal';

function formatRange(start: string, end: string): string {
  const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

export default function AdminCyclesPage() {
  const { data, isLoading } = useAdminCycles();
  const archive = useArchiveCycle();
  const [newOpen, setNewOpen] = useState(false);

  const confirmArchive = (cycle: CycleRow) => {
    if (!confirm(`Archive cycle "${cycle.name}"?`)) return;
    archive.mutate(cycle.id);
  };

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Eyebrow>Cycles</Eyebrow>
          <h1 className="mt-2 font-serif-tool text-3xl font-semibold tracking-tight">
            Cycles
          </h1>
          <p className="mt-1 font-mono text-xs text-ink-mute">
            {data ? `${data.length} total` : 'Loading…'}
          </p>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          New cycle
        </button>
      </div>

      {isLoading ? (
        <p className="font-mono text-xs uppercase tracking-label text-ink-mute">
          Loading…
        </p>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="font-mono text-xs text-ink-mute py-12 text-center border border-dashed border-rule rounded-card">
          No cycles yet. Create one to get started.
        </p>
      ) : (
        <ul className="divide-y divide-rule border border-rule rounded-card bg-surface">
          {(data ?? []).map((cycle) => {
            const memberCount =
              cycle._count?.memberships ?? cycle.memberships?.length ?? 0;
            return (
              <li
                key={cycle.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-paper-warm/60 transition-colors"
              >
                <Link
                  href={`/admin/cycle/${cycle.id}`}
                  className="flex-1 min-w-0 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-serif-tool text-base font-semibold text-ink">
                      {cycle.name}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                      {formatRange(cycle.startsAt, cycle.endsAt)}
                      {' · '}
                      {memberCount} members
                      {cycle.rankingVisibleToMembers && ' · ranking visible'}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      'font-mono text-[10px] uppercase tracking-label px-2 py-0.5 rounded-pill border',
                      cycle.status === 'ACTIVE'
                        ? 'text-ink border-ink/40 bg-paper'
                        : 'text-ink-mute border-rule',
                    )}
                  >
                    {cycle.status}
                  </span>
                </Link>
                {cycle.status === 'ACTIVE' && (
                  <button
                    onClick={() => confirmArchive(cycle)}
                    disabled={archive.isPending}
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-mute hover:text-ink disabled:opacity-40"
                  >
                    <Archive className="h-3 w-3" strokeWidth={1.5} />
                    archive
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <NewCycleModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
