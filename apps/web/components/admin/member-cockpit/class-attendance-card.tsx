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
    <section className="bg-surface border border-border-token rounded-card p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-sans text-xs text-fg-mute font-medium">
          Class attendance
        </p>
        <span className="font-sans text-xs text-fg-mute">
          cohort {classAttendance.cohortPresent}/{classAttendance.total}
        </span>
      </div>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="font-sans tabular-nums font-semibold text-fg text-3xl">
          {classAttendance.present}
        </span>
        <span className="font-sans tabular-nums text-fg-mute text-base">
          / {classAttendance.total}
        </span>
      </p>
      <div className="mt-3 flex items-center gap-1.5">
        {classAttendance.sessions.map((s, i) => (
          <span
            key={i}
            className={clsx(
              'w-5 h-5 rounded-sm',
              s.status === 'PRESENT' ? 'bg-ink' : 'bg-bg-subtle border border-border-token',
            )}
            title={new Date(s.scheduledAt).toLocaleDateString()}
          />
        ))}
        {missed > 0 && (
          <span className="ml-auto font-sans text-xs text-fg-mute">
            {missed} missed
          </span>
        )}
      </div>
      <div className="mt-4 pt-3 border-t border-border-token grid grid-cols-2 gap-3">
        <div>
          <p className="font-sans text-xs text-fg-mute font-medium">
            First session
          </p>
          <p className="font-sans tabular-nums text-fg text-sm mt-0.5">
            {firstSession
              ? new Date(firstSession.occurredAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : '—'}{' '}
            <span className="text-fg-mute">· day {firstSession?.dayOfCycle ?? '—'}</span>
          </p>
        </div>
        <div>
          <p className="font-sans text-xs text-fg-mute font-medium">
            Cycle progress
          </p>
          <p className="font-sans tabular-nums text-fg text-sm mt-0.5">
            w{cycle?.weekNumber ?? '?'} / {cycle?.weeksTotal ?? '?'}{' '}
            <span className="text-fg-mute">
              · {cycle ? Math.round((cycle.weekNumber / cycle.weeksTotal) * 100) : 0}%
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
