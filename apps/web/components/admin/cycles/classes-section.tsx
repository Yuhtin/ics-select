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
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ml-auto inline-flex items-center gap-1.5 font-sans text-xs font-medium px-2.5 py-1 text-fg-soft hover:text-fg"
          >
            <Plus className="h-3 w-3" strokeWidth={1.75} />
            Schedule
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="mt-2 font-sans text-xs text-fg-mute py-4 text-center border border-dashed border-border-token rounded-card">
            No classes scheduled yet.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border-token border border-border-token rounded-card bg-surface">
            {sorted.map((c) => {
              const past = new Date(c.scheduledAt) < new Date();
              return (
                <li
                  key={c.id}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 hover:bg-bg-subtle/60 transition-colors',
                    past && 'text-fg-soft',
                  )}
                >
                  <span className="font-mono text-[10px] uppercase tracking-label text-fg-mute w-28 flex-none truncate">
                    {formatShort(c.scheduledAt)}
                  </span>
                  <span className="font-sans text-sm font-medium text-fg truncate flex-1 min-w-0">
                    {c.title}
                    {c.topic && (
                      <span className="ml-2 font-sans text-xs font-medium text-fg-mute">
                        · {c.topic}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[10px] text-fg-mute w-10 flex-none text-right">
                    {c.durationMin}m
                  </span>
                  <button
                    onClick={() => setAttendanceFor(c)}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface inline-flex items-center gap-1 font-sans text-xs font-medium text-primary dark:text-fg-soft hover:underline flex-none"
                    aria-label={`Attendance for ${c.title}`}
                    title="Take attendance"
                  >
                    <Users className="h-3 w-3 text-primary" strokeWidth={1.75} />
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
