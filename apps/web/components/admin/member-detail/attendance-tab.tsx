'use client';
import type { MemberDetailResponse } from '../../../lib/queries/admin-member';

type AttendanceEntry = MemberDetailResponse['attendance'][number];

const STATUS_CONFIG: Record<
  'PRESENT' | 'ABSENT' | 'LATE',
  { label: string; dotClass: string; textClass: string }
> = {
  PRESENT: {
    label: 'Present',
    dotClass: 'bg-outcome-done-easy',
    textClass: 'text-outcome-done-easy',
  },
  LATE: {
    label: 'Late',
    dotClass: 'bg-outcome-done-hard',
    textClass: 'text-outcome-done-hard',
  },
  ABSENT: {
    label: 'Absent',
    dotClass: 'bg-outcome-stuck',
    textClass: 'text-outcome-stuck',
  },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function StatusPill({ status }: { status: AttendanceEntry['status'] }) {
  if (!status) {
    return (
      <span className="font-sans text-xs text-fg-mute">—</span>
    );
  }
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 font-sans text-xs ${cfg.textClass}`}>
      <span
        className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${cfg.dotClass}`}
        aria-hidden="true"
      />
      {cfg.label}
    </span>
  );
}

export function AttendanceTab({
  attendance,
}: {
  attendance: MemberDetailResponse['attendance'];
}) {
  if (attendance.length === 0) {
    return (
      <p className="font-sans text-xs text-fg-mute">
        No classes scheduled in this cycle yet.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {attendance.map((cls) => (
        <div
          key={cls.classId}
          className="flex items-center gap-4 py-3 border-b border-border-token last:border-0"
        >
          <div className="w-28 flex-shrink-0">
            <p className="font-sans text-xs text-fg-mute">{formatDate(cls.scheduledAt)}</p>
            <p className="font-sans text-xs text-fg-mute">{formatTime(cls.scheduledAt)}</p>
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-sans text-sm font-medium text-fg truncate">
              {cls.classTitle}
            </p>
            {cls.topic && (
              <p className="mt-0.5 font-sans text-xs text-fg-mute truncate">{cls.topic}</p>
            )}
          </div>

          <div className="w-24 flex-shrink-0 text-right">
            <p className="font-sans text-xs text-fg-mute">{cls.durationMin}min</p>
          </div>

          <div className="w-20 flex-shrink-0 flex justify-end">
            <StatusPill status={cls.status} />
          </div>
        </div>
      ))}
    </div>
  );
}
