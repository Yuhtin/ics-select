'use client';
import { useMemo, useState } from 'react';
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
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';

type Phase = 'active' | 'upcoming' | 'past' | 'archived';

function formatRange(start: string, end: string): string {
  const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

// Phase is purely a function of date range + status. We intentionally do NOT
// use resolveActiveCycleId here — that helper returns a single "the active
// cycle" for navigation/landing redirects, but the admin cycles list needs to
// surface every running cycle as Active. Otherwise, when two ACTIVE cycles
// overlap (main + bench), the one with the older startsAt would drop into
// "past" even though now is still inside its range.
function phaseOf(cycle: CycleRow, now: Date): Phase {
  if (cycle.status === 'ARCHIVED') return 'archived';
  const start = new Date(cycle.startsAt).getTime();
  const end = new Date(cycle.endsAt).getTime();
  const nowMs = now.getTime();
  if (nowMs < start) return 'upcoming';
  if (nowMs > end) return 'past';
  return 'active';
}

const PHASE_CLASS: Record<Phase, string> = {
  active: 'bg-ink text-paper border-ink',
  upcoming: 'bg-paper text-ink border-ink/40',
  past: 'bg-paper-warm text-ink-mute border-rule',
  archived: 'bg-paper text-ink-faint border-rule',
};

const PHASE_LABEL: Record<Phase, string> = {
  active: 'Active',
  upcoming: 'Upcoming',
  past: 'Past',
  archived: 'Archived',
};

const PHASE_ORDER: Record<Phase, number> = {
  active: 0,
  upcoming: 1,
  past: 2,
  archived: 3,
};

export default function AdminCyclesPage() {
  const { data, isLoading } = useAdminCycles();
  const archive = useArchiveCycle();
  const [newOpen, setNewOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<CycleRow | null>(null);
  const now = useMemo(() => new Date(), []);

  const rows = useMemo(() => {
    if (!data) return [] as Array<{ cycle: CycleRow; phase: Phase }>;
    const annotated = data.map((cycle) => ({
      cycle,
      phase: phaseOf(cycle, now),
    }));
    annotated.sort((a, b) => {
      const pa = PHASE_ORDER[a.phase];
      const pb = PHASE_ORDER[b.phase];
      if (pa !== pb) return pa - pb;
      return (
        new Date(b.cycle.startsAt).getTime() - new Date(a.cycle.startsAt).getTime()
      );
    });
    return annotated;
  }, [data, now]);

  const confirmArchive = () => {
    if (!archiveTarget) return;
    archive.mutate(archiveTarget.id, {
      onSettled: () => setArchiveTarget(null),
    });
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
      ) : rows.length === 0 ? (
        <p className="font-mono text-xs text-ink-mute py-12 text-center border border-dashed border-rule rounded-card">
          No cycles yet. Create one to get started.
        </p>
      ) : (
        <ul className="divide-y divide-rule border border-rule rounded-card bg-surface">
          {rows.map(({ cycle, phase }) => {
            const memberCount =
              cycle._count?.memberships ?? cycle.memberships?.length ?? 0;
            return (
              <li
                key={cycle.id}
                className={clsx(
                  'flex items-center gap-4 px-4 py-3 transition-colors',
                  phase === 'active'
                    ? 'bg-paper-warm/40'
                    : 'hover:bg-paper-warm/60',
                )}
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
                      PHASE_CLASS[phase],
                    )}
                  >
                    {PHASE_LABEL[phase]}
                  </span>
                </Link>
                {cycle.status === 'ACTIVE' && (
                  <button
                    onClick={() => setArchiveTarget(cycle)}
                    disabled={archive.isPending}
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-mute hover:text-ink disabled:opacity-40"
                    title="Archive this cycle"
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
      <ConfirmDialog
        isOpen={archiveTarget !== null}
        onClose={() => {
          if (!archive.isPending) setArchiveTarget(null);
        }}
        onConfirm={confirmArchive}
        title="Archive cycle?"
        description={
          archiveTarget ? (
            <>
              Archive <span className="font-semibold text-ink">{archiveTarget.name}</span>? Members
              will keep their data, but the cycle won&apos;t appear as active anymore.
            </>
          ) : null
        }
        confirmLabel="Archive"
        isLoading={archive.isPending}
      />
    </div>
  );
}
