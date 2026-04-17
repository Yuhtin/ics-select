'use client';
import { useState } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { useAdminMemberDiagnose } from '../../../lib/queries/admin-member';

export function DiagnoseTab({ memberId }: { memberId: string }) {
  const [enabled, setEnabled] = useState(false);
  const { data, isLoading, refetch, isFetching } = useAdminMemberDiagnose(memberId, enabled);

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-4">
        <Sparkles className="h-6 w-6 text-accent" strokeWidth={1.5} />
        <p className="font-sans text-sm text-ink-soft max-w-sm">
          Generate an AI diagnose to see detailed analysis of this member&apos;s trajectory.
        </p>
        <button
          type="button"
          onClick={() => setEnabled(true)}
          className="font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill hover:opacity-90"
        >
          Generate ▸
        </button>
      </div>
    );
  }

  if (isLoading || isFetching) {
    return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Analyzing… (may take 10-15s)</p>;
  }

  if (!data) {
    return <p className="font-sans text-sm text-outcome-stuck">Failed to generate diagnose.</p>;
  }

  const paragraphs = (data.markdown ?? '').split('\n\n').filter((p) => p.trim().length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute">
          Cached {new Date(data.cachedAt).toLocaleString('en-US')}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-label text-ink-soft hover:text-ink"
        >
          <RotateCcw className="h-3 w-3" strokeWidth={1.5} />
          Regenerate
        </button>
      </div>
      <div className="prose-sm max-w-none">
        {paragraphs.map((p, idx) => (
          <p key={idx} className="font-serif-tool text-base leading-relaxed text-ink mb-3">{p}</p>
        ))}
      </div>
    </div>
  );
}
