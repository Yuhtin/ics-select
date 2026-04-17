import { clsx } from 'clsx';
import type { MemberDetailResponse } from '../../../lib/queries/admin-member';

type Plan = MemberDetailResponse['timeline'][number];

const DOT_BY_OUTCOME: Record<Plan['items'][number]['outcome'], string> = {
  PENDING: 'bg-outcome-pending',
  DONE_EASY: 'bg-outcome-done-easy',
  DONE_HARD: 'bg-outcome-done-hard',
  DOUBTS: 'bg-outcome-doubts',
  STUCK: 'bg-outcome-stuck',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TimelineTab({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) return <p className="font-mono text-xs text-ink-mute">No plans yet.</p>;
  return (
    <div className="space-y-8">
      {plans.map((plan) => {
        const doneCount = plan.items.filter((i) => i.outcome === 'DONE_EASY' || i.outcome === 'DONE_HARD').length;
        return (
          <article key={plan.planId} className="space-y-3">
            <header className="flex items-center gap-3">
              <h3 className="font-serif-tool text-lg font-semibold text-ink">
                Week of {formatDate(plan.weekStart)}
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                {plan.status} · {doneCount}/{plan.items.length}
              </span>
            </header>
            <ul className="space-y-2">
              {plan.items.map((item) => (
                <li key={item.id} className="border border-rule rounded-card p-3 bg-surface">
                  <div className="flex items-start gap-3">
                    <span className={clsx('mt-1.5 inline-block h-2 w-2 rounded-full', DOT_BY_OUTCOME[item.outcome])} />
                    <div className="flex-1 min-w-0">
                      <p className="font-serif-tool text-sm font-semibold text-ink">{item.title}</p>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-ink-mute">
                        <span>{item.outcome.replace('_', ' ').toLowerCase()}</span>
                        {item.topicLabel && <><span>·</span><span>{item.topicLabel}</span></>}
                      </div>
                      {item.reflection && (
                        <p className="mt-2 font-serif italic text-sm text-ink-soft">&ldquo;{item.reflection}&rdquo;</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
