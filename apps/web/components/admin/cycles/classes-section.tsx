'use client';
import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SectionLabel>Classes · {sorted.length}</SectionLabel>
          <button
            onClick={() => setScheduleOpen(true)}
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-label px-3 py-1.5 bg-paper-warm text-ink-soft rounded-pill hover:bg-rule"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Schedule class
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="mt-4 font-mono text-xs text-ink-mute py-8 text-center border border-dashed border-rule rounded-card">
            No classes scheduled yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-rule border border-rule rounded-card bg-surface">
            {sorted.map((c) => {
              const past = new Date(c.scheduledAt) < new Date();
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-paper-warm/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-serif-tool text-base font-semibold text-ink truncate">
                      {c.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap font-mono text-[10px] uppercase tracking-label text-ink-mute">
                      <span>{formatDateTime(c.scheduledAt)}</span>
                      <span>·</span>
                      <span>{c.durationMin}m</span>
                      {c.topic && (
                        <>
                          <span>·</span>
                          <span>{c.topic}</span>
                        </>
                      )}
                      {past && (
                        <>
                          <span>·</span>
                          <span className="text-ink-soft">past</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setAttendanceFor(c)}
                    className="inline-flex items-center gap-1.5 font-mono text-[11px] text-focus hover:underline"
                  >
                    <Users className="h-3 w-3" strokeWidth={1.5} />
                    Take attendance →
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
