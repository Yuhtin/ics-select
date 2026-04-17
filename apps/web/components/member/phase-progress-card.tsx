'use client';

import type { TopicCoverage } from '../../lib/queries/me-home';
import { ProgressBar } from '../ui/progress-bar';

interface Props {
  topics: TopicCoverage[];
  limit?: number;
}

export function PhaseProgressCard({ topics, limit = 4 }: Props) {
  const visible = topics
    .filter((t) => t.itemsPlanned > 0)
    .slice(0, limit);

  return (
    <section className="rounded-tile border border-border-token bg-surface p-6">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
        Cycle progress
      </p>
      {visible.length === 0 ? (
        <p className="mt-3 font-sans text-xs text-fg-mute">
          Your cycle has no planned items yet.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {visible.map((t) => {
            const pct = t.itemsPlanned === 0 ? 0 : t.itemsDone / t.itemsPlanned;
            const tone =
              pct >= 1 ? 'success' : pct >= 0.25 ? 'primary' : 'default';
            return (
              <ProgressBar
                key={t.topicId}
                value={pct}
                tone={tone}
                label={t.label}
                valueLabel={`${t.itemsDone}/${t.itemsPlanned}`}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
