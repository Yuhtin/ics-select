'use client';
import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { clsx } from 'clsx';
import {
  useCycleClasses,
  type ClassSession,
} from '../../../lib/queries/admin-classes';
import { SectionLabel } from '../../ui/section-label';
import { ScheduleClassModal } from './schedule-class-modal';
import { AttendanceModal } from './attendance-modal';

type Member = {
  userId: string;
  name: string;
  pictureUrl: string | null;
};

function formatShort(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ClassesSection({
  cycleId,
  members,
}: {
  cycleId: string;
  members: Member[];
}) {
  const { data: classes } = useCycleClasses(cycleId);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [attendanceFor, setAttendanceFor] = useState<ClassSession | null>(null);

  const sorted = [...(classes ?? [])].sort(
    (a, b) =>
      new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
  );

  return (
    <>
      <section>
        <div className="flex items-center gap-3">
          <SectionLabel>Classes · {sorted.length}</SectionLabel>
          <button
            onClick={() => setScheduleOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-label px-2.5 py-1 text-ink-soft hover:text-ink"
          >
            <Plus className="h-3 w-3" strokeWidth={1.75} />
            Schedule
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="mt-2 font-mono text-[11px] text-ink-mute py-4 text-center border border-dashed border-rule rounded-card">
            No classes scheduled yet.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-rule border border-rule rounded-card bg-surface">
            {sorted.map((c) => {
              const past = new Date(c.scheduledAt) < new Date();
              return (
                <li
                  key={c.id}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 hover:bg-paper-warm/60 transition-colors',
                    past && 'text-ink-soft',
                  )}
                >
                  <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute w-28 flex-none truncate">
                    {formatShort(c.scheduledAt)}
                  </span>
                  <span className="font-sans text-sm font-medium text-ink truncate flex-1 min-w-0">
                    {c.title}
                    {c.topic && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-label text-ink-mute">
                        · {c.topic}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[10px] text-ink-mute w-10 flex-none text-right">
                    {c.durationMin}m
                  </span>
                  <button
                    onClick={() => setAttendanceFor(c)}
                    className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label text-focus hover:underline flex-none"
                    aria-label={`Attendance for ${c.title}`}
                    title="Take attendance"
                  >
                    <Users className="h-3 w-3" strokeWidth={1.75} />
                    Attendance
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ScheduleClassModal
        cycleId={cycleId}
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
      />
      <AttendanceModal
        cycleId={cycleId}
        session={attendanceFor}
        members={members}
        open={attendanceFor !== null}
        onClose={() => setAttendanceFor(null)}
      />
    </>
  );
}
