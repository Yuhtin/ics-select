'use client';

import { use } from 'react';
import { useChallengeAttempt } from '../../../../../lib/queries/me-challenges';
import { ChallengeEditor } from '../../../../../components/member/challenge-editor';

export default function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useChallengeAttempt(id);

  if (isLoading) {
    return (
      <p className="font-mono text-xs uppercase tracking-label text-ink-mute p-6">
        Loading challenge…
      </p>
    );
  }
  if (error || !data) {
    return (
      <p className="font-mono text-xs uppercase tracking-label text-outcome-stuck p-6">
        Could not load this challenge. {error instanceof Error ? error.message : ''}
      </p>
    );
  }
  return <ChallengeEditor attempt={data} />;
}
