import type { CockpitResponse } from '../../../lib/queries/admin-cockpit';
import { clsx } from 'clsx';

export function ClassAttendanceCard({
  classAttendance,
  firstSession,
  cycle,
}: {
  classAttendance: CockpitResponse['classAttendance'];
  firstSession: CockpitResponse['firstSession'];
  cycle: CockpitResponse['cycle'];
}) {
  const missed = classAttendance.total - classAttendance.present;
  return (
    <section className="bg-surface border border-rule rounded-lg p-6">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
          Class attendance
        </p>
        <span className="font-mono text-[11px] text-ink-faint">
          cohort {classAttendance.cohortPresent}/{classAttendance.total}
        </span>
      </div>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="font-serif-tool tabular-nums font-semibold text-ink text-3xl">
          {classAttendance.present}
        </span>
        <span className="font-serif-tool tabular-nums text-ink-mute text-base">
          / {classAttendance.total}
        </span>
      </p>
      <div className="mt-3 flex items-center gap-1.5">
        {classAttendance.sessions.map((s, i) => (
          <span
            key={i}
            className={clsx(
              'w-5 h-5 rounded-sm',
              s.status === 'PRESENT' ? 'bg-ink' : 'bg-paper-warm border border-rule',
            )}
            title={new Date(s.scheduledAt).toLocaleDateString()}
          />
        ))}
        {missed > 0 && (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            {missed} missed
          </span>
        )}
      </div>
      <div className="mt-4 pt-3 border-t border-rule grid grid-cols-2 gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
            First session
          </p>
          <p className="font-serif-tool tabular-nums text-ink text-sm mt-0.5">
            {firstSession
              ? new Date(firstSession.occurredAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : '—'}{' '}
            <span className="text-ink-faint">· day {firstSession?.dayOfCycle ?? '—'}</span>
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
            Cycle progress
          </p>
          <p className="font-serif-tool tabular-nums text-ink text-sm mt-0.5">
            w{cycle?.weekNumber ?? '?'} / {cycle?.weeksTotal ?? '?'}{' '}
            <span className="text-ink-faint">
              · {cycle ? Math.round((cycle.weekNumber / cycle.weeksTotal) * 100) : 0}%
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
