'use client';
import { useState } from 'react';
import { useCreateCycle } from '../../../lib/queries/admin-cycles';

export function NewCycleModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const create = useCreateCycle();

  if (!open) return null;

  const handleSubmit = async () => {
    if (!name.trim() || !startsAt || !endsAt) return;
    await create.mutateAsync({
      name: name.trim(),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
    });
    setName('');
    setStartsAt('');
    setEndsAt('');
    onClose();
  };

  const INPUT =
    'w-full rounded-input border border-rule bg-paper px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-card bg-surface border border-rule p-6 shadow-modal">
        <h3 className="font-serif-tool text-xl font-semibold text-ink">New cycle</h3>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="2026.2"
              className={`mt-1 ${INPUT}`}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                Starts at
              </span>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={`mt-1 ${INPUT}`}
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                Ends at
              </span>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={`mt-1 ${INPUT}`}
              />
            </label>
          </div>
          {create.error && (
            <p className="font-mono text-[10px] text-outcome-stuck">
              {(create.error as Error).message}
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
            onClick={handleSubmit}
            disabled={
              !name.trim() || !startsAt || !endsAt || create.isPending
            }
            className="font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill disabled:opacity-40"
          >
            {create.isPending ? 'Creating…' : 'Create cycle'}
          </button>
        </div>
      </div>
    </div>
  );
}
