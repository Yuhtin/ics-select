'use client';

export interface OverflowItem {
  itemId: string;
  minutesRequired: number;
}

export function OverflowModal({
  open,
  overflow,
  memberName,
  onClose,
  onForce,
  pending,
}: {
  open: boolean;
  overflow: OverflowItem[];
  memberName: string;
  onClose: () => void;
  onForce: () => void;
  pending: boolean;
}) {
  if (!open) return null;
  const total = overflow.reduce((s, o) => s + o.minutesRequired, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="w-full max-w-md rounded-card bg-surface border border-rule p-6 shadow-modal">
        <h3 className="font-serif-tool text-xl font-semibold text-outcome-stuck">
          Plan doesn&rsquo;t fit {memberName}&rsquo;s availability.
        </h3>
        <p className="mt-3 font-sans text-sm text-ink-soft">
          Overflow: {overflow.length} item{overflow.length === 1 ? '' : 's'} ({total} min).
        </p>
        <p className="mt-2 font-sans text-sm text-ink-soft">
          Adjust the plan or force publish — Calendar events will be created but conflicts may remain.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 text-ink-soft hover:bg-paper-warm rounded-pill"
          >
            Adjust
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onForce}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 bg-outcome-stuck text-paper rounded-pill disabled:opacity-40"
          >
            {pending ? 'Forcing…' : 'Force publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
