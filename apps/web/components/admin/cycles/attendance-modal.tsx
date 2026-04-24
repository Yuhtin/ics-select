'use client';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import {
  useSubmitAttendance,
  type AttendanceStatus,
  type ClassSession,
} from '../../../lib/queries/admin-classes';

type Member = {
  userId: string;
  name: string;
  pictureUrl: string | null;
};

const STATUS_TONE: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-outcome-done-easy text-paper border-outcome-done-easy',
  LATE: 'bg-outcome-done-hard text-paper border-outcome-done-hard',
  ABSENT: 'bg-outcome-stuck text-paper border-outcome-stuck',
};

function Initials({
  name,
  pictureUrl,
  size = 32,
}: {
  name: string;
  pictureUrl: string | null;
  size?: number;
}) {
  if (pictureUrl) {
    return (
      <img
        src={pictureUrl}
        alt=""
        className="rounded-full object-cover border border-rule"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-paper-warm border border-rule font-serif text-ink text-xs font-semibold"
      style={{ width: size, height: size }}
    >
      {initials || '—'}
    </span>
  );
}

export function AttendanceModal({
  cycleId,
  session,
  members,
  open,
  onClose,
}: {
  cycleId: string;
  session: ClassSession | null;
  members: Member[];
  open: boolean;
  onClose: () => void;
}) {
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const submit = useSubmitAttendance();

  useEffect(() => {
    if (!open || !session) return;
    const seed: Record<string, AttendanceStatus> = {};
    for (const m of members) {
      const existing = session.attendances?.find((a) => a.userId === m.userId);
      seed[m.userId] = existing?.status ?? 'PRESENT';
    }
    setStatuses(seed);
  }, [open, session, members]);

  if (!open || !session) return null;

  const set = (userId: string, status: AttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [userId]: status }));
  };

  const save = async () => {
    const rows = members.map((m) => ({
      userId: m.userId,
      status: statuses[m.userId] ?? 'PRESENT',
    }));
    await submit.mutateAsync({ cycleId, classId: session.id, rows });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-card bg-surface border border-rule p-6 shadow-modal max-h-[85vh] overflow-y-auto">
        <h3 className="font-serif-tool text-xl font-semibold text-ink">
          Attendance · {session.title}
        </h3>
        <p className="mt-1 font-mono text-xs text-ink-mute">
          {new Date(session.scheduledAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <ul className="mt-5 space-y-2">
          {members.map((m) => {
            const cur = statuses[m.userId] ?? 'PRESENT';
            return (
              <li
                key={m.userId}
                className="flex items-center gap-3 border border-rule rounded-card px-3 py-2 bg-paper"
              >
                <Initials name={m.name} pictureUrl={m.pictureUrl} />
                <p className="flex-1 font-serif-tool text-sm font-semibold text-ink truncate">
                  {m.name}
                </p>
                <div className="flex gap-1">
                  {(['PRESENT', 'LATE', 'ABSENT'] as AttendanceStatus[]).map(
                    (s) => (
                      <button
                        key={s}
                        onClick={() => set(m.userId, s)}
                        className={clsx(
                          'font-mono text-[10px] uppercase tracking-label px-3 py-1 rounded-pill border transition-colors',
                          cur === s
                            ? STATUS_TONE[s]
                            : 'bg-paper text-ink-mute border-rule hover:bg-paper-warm',
                        )}
                      >
                        {s.toLowerCase()}
                      </button>
                    ),
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 text-ink-soft hover:bg-paper-warm rounded-pill"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={submit.isPending}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill disabled:opacity-40"
          >
            {submit.isPending ? 'Saving…' : 'Save attendance'}
          </button>
        </div>
      </div>
    </div>
  );
}
