'use client';
import { useState } from 'react';
import { useScheduleClass } from '../../../lib/queries/admin-classes';

const INPUT =
  'w-full rounded-input border border-rule bg-paper px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40';

export function ScheduleClassModal({
  cycleId,
  open,
  onClose,
}: {
  cycleId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMin, setDurationMin] = useState(90);
  const [notes, setNotes] = useState('');
  const schedule = useScheduleClass();

  if (!open) return null;

  const submit = async () => {
    if (!title.trim() || !scheduledAt) return;
    await schedule.mutateAsync({
      cycleId,
      title: title.trim(),
      topic: topic.trim() || null,
      scheduledAt: new Date(scheduledAt).toISOString(),
      durationMin,
      notes: notes.trim() || undefined,
    });
    setTitle('');
    setTopic('');
    setScheduledAt('');
    setDurationMin(90);
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="w-full max-w-md rounded-card bg-surface border border-rule p-6 shadow-modal">
        <h3 className="font-serif-tool text-xl font-semibold text-ink">
          Schedule class
        </h3>
        <div className="mt-4 space-y-3">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Aula 4 · DP intro"
              className={INPUT}
            />
          </Field>
          <Field label="Topic (optional)">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="dp"
              className={INPUT}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="When">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className={INPUT}
              />
            </Field>
            <Field label="Duration (min)">
              <input
                type="number"
                min={15}
                step={15}
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className={INPUT}
              />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={`${INPUT} resize-vertical`}
            />
          </Field>
          {schedule.error && (
            <p className="font-mono text-[10px] text-outcome-stuck">
              {(schedule.error as Error).message}
            </p>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 text-ink-soft hover:bg-paper-warm rounded-pill"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!title.trim() || !scheduledAt || schedule.isPending}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill disabled:opacity-40"
          >
            {schedule.isPending ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
