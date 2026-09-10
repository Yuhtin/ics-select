'use client';
import { useState } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { useAdminMemberDiagnose } from '../../../lib/queries/admin-member';

export function DiagnoseTab({ memberId }: { memberId: string }) {
  const [enabled, setEnabled] = useState(false);
  const { data, isLoading, refetch, isFetching } = useAdminMemberDiagnose(memberId, enabled);

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
        <Sparkles className="h-6 w-6 text-primary" strokeWidth={1.5} />
        <p className="font-sans text-sm text-fg-soft max-w-sm">
          Generate an AI diagnose to see detailed analysis of this member&apos;s trajectory.
        </p>
        <button
          type="button"
          onClick={() => setEnabled(true)}
          className="font-sans text-xs px-4 py-2 bg-primary text-primary-fg rounded-pill hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Generate ▸
        </button>
      </div>
    );
  }

  if (isLoading || isFetching) {
    return <p className="font-sans text-xs text-fg-mute">Analyzing… (may take 10-15s)</p>;
  }

  if (!data) {
    return <p className="font-sans text-sm text-outcome-stuck">Failed to generate diagnose.</p>;
  }

  const paragraphs = (data.markdown ?? '').split('\n\n').filter((p) => p.trim().length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-sans text-xs text-fg-mute">
          Cached {new Date(data.cachedAt).toLocaleString('en-US')}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 font-sans text-xs text-fg-soft hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <RotateCcw className="h-3 w-3" strokeWidth={1.5} />
          Regenerate
        </button>
      </div>
      <div className="prose-sm max-w-none">
        {paragraphs.map((p, idx) => (
          <p key={idx} className="font-sans text-base leading-relaxed text-fg mb-3">{p}</p>
        ))}
      </div>
    </div>
  );
}
