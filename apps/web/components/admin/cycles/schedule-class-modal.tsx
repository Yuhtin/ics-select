'use client';
import { useState } from 'react';
import { useScheduleClass } from '../../../lib/queries/admin-classes';

const INPUT =
  'w-full min-h-10 rounded-input border border-border-token bg-surface px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-card bg-surface border border-border-token p-6 shadow-modal max-h-[90dvh] overflow-y-auto">
        <h3 className="font-sans text-xl font-semibold text-fg">
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
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
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
            <p className="font-sans text-xs text-outcome-stuck">
              {(schedule.error as Error).message}
            </p>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface font-sans text-xs font-medium px-4 py-2 text-fg-soft hover:bg-bg-subtle rounded-pill"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!title.trim() || !scheduledAt || schedule.isPending}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface font-sans text-xs font-medium px-4 py-2 bg-primary text-primary-fg rounded-pill disabled:opacity-40"
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
      <span className="font-sans text-xs font-medium text-fg-mute">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
