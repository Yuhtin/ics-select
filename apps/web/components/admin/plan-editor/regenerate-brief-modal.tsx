'use client';
import { useState } from 'react';

export function RegenerateBriefModal({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (brief: string) => void;
  loading: boolean;
}) {
  const [brief, setBrief] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-card bg-surface border border-rule p-6 shadow-modal">
        <h3 className="font-serif-tool text-xl font-semibold text-ink">Regenerate with brief</h3>
        <p className="mt-1 font-sans text-sm text-ink-soft">
          Dá uma direção extra pro plano — foco, dificuldade, o que evitar.
        </p>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value.slice(0, 200))}
          rows={4}
          placeholder="Ex: foca mais em hard, tá faltando velocidade."
          className="mt-4 w-full rounded-input border border-rule bg-paper p-3 font-sans text-sm resize-none focus:outline-none focus:ring-2 focus:ring-focus/40"
        />
        <p className="mt-1 font-mono text-[10px] text-ink-mute text-right">{brief.length} / 200</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 text-ink-soft hover:bg-paper-warm rounded-pill"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={brief.trim().length === 0 || loading}
            onClick={() => onSubmit(brief.trim())}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill disabled:opacity-40"
          >
            {loading ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
      </div>
    </div>
  );
}
