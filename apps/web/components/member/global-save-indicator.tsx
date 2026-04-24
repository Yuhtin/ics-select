'use client';
import { useEffect, useState } from 'react';
import { useIsMutating, useQueryClient, type Mutation } from '@tanstack/react-query';
import { Check, Loader2, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useSettingsError } from './settings-error-context';

type Status = 'idle' | 'saving' | 'error' | 'overlap';

const ERROR_VISIBLE_MS = 5_000;

export function GlobalSaveIndicator() {
  const isMutating = useIsMutating({ mutationKey: ['me'] });
  const qc = useQueryClient();
  const { error } = useSettingsError();

  const [lastError, setLastError] = useState<{
    mutation: Mutation<unknown, unknown, unknown, unknown>;
    until: number;
  } | null>(null);

  useEffect(() => {
    const mutationCache = qc.getMutationCache();
    const unsubscribe = mutationCache.subscribe((event) => {
      if (event.type !== 'updated') return;
      const mutation = event.mutation as Mutation<unknown, unknown, unknown, unknown>;
      const key = (mutation.options?.mutationKey as unknown[] | undefined) ?? [];
      if (!Array.isArray(key) || key[0] !== 'me') return;
      if (mutation.state.status === 'error') {
        setLastError({ mutation, until: Date.now() + ERROR_VISIBLE_MS });
      } else if (mutation.state.status === 'success') {
        setLastError((prev) => (prev && prev.mutation === mutation ? null : prev));
      }
    });
    return unsubscribe;
  }, [qc]);

  useEffect(() => {
    if (!lastError) return;
    const delay = Math.max(0, lastError.until - Date.now());
    const t = setTimeout(() => setLastError(null), delay);
    return () => clearTimeout(t);
  }, [lastError]);

  const status: Status = error.hasOverlap
    ? 'overlap'
    : isMutating > 0
    ? 'saving'
    : lastError
    ? 'error'
    : 'idle';

  const handleRetry = () => {
    if (!lastError) return;
    const m = lastError.mutation;
    const vars = (m.state.variables ?? undefined) as unknown;
    void qc.getMutationCache().build(qc, m.options).execute(vars as never);
    setLastError(null);
  };

  return (
    <div
      className={clsx(
        'flex items-center gap-2 rounded-pill px-3 py-1 font-mono text-[11px] font-semibold',
        status === 'idle' && 'text-success',
        status === 'saving' && 'text-fg-mute',
        status === 'error' && 'text-danger',
        status === 'overlap' && 'text-outcome-stuck',
      )}
      role="status"
      aria-live="polite"
    >
      {status === 'idle' && (
        <>
          <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>Saved</span>
        </>
      )}
      {status === 'saving' && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
          <span>Saving…</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />
          <button
            type="button"
            onClick={handleRetry}
            className="underline underline-offset-2 hover:text-fg"
          >
            Save failed — Retry
          </button>
        </>
      )}
      {status === 'overlap' && (
        <>
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>Fix overlap to save</span>
        </>
      )}
    </div>
  );
}
