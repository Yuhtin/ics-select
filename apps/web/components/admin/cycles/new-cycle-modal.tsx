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
    'w-full min-h-10 rounded-input border border-border-token bg-surface px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-card bg-surface border border-border-token p-6 shadow-modal max-h-[90dvh] overflow-y-auto">
        <h3 className="font-sans text-xl font-semibold text-fg">New cycle</h3>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="font-sans text-xs font-medium text-fg-mute">
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
              <span className="font-sans text-xs font-medium text-fg-mute">
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
              <span className="font-sans text-xs font-medium text-fg-mute">
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
            <p className="font-sans text-xs text-outcome-stuck">
              {(create.error as Error).message}
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
            onClick={handleSubmit}
            disabled={
              !name.trim() || !startsAt || !endsAt || create.isPending
            }
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface font-sans text-xs font-medium px-4 py-2 bg-primary text-primary-fg rounded-pill disabled:opacity-40"
          >
            {create.isPending ? 'Creating…' : 'Create cycle'}
          </button>
        </div>
      </div>
    </div>
  );
}
