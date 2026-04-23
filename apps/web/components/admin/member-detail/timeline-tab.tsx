'use client';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { clsx } from 'clsx';
import type { MemberDetailResponse } from '../../../lib/queries/admin-member';

type Plan = MemberDetailResponse['timeline'][number];

const DOT_BY_OUTCOME: Record<Plan['items'][number]['outcome'], string> = {
  PENDING: 'bg-outcome-pending',
  DONE_EASY: 'bg-outcome-done-easy',
  DONE_HARD: 'bg-outcome-done-hard',
  DOUBTS: 'bg-outcome-doubts',
  STUCK: 'bg-outcome-stuck',
  SKIPPED: 'bg-outcome-skipped',
};

function formatDate(iso: string): string {
  // plan.weekStart is UTC midnight Monday — render in UTC so viewers west of
  // UTC don't see Sunday night instead of Monday.
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function TimelineTab({
  memberId,
  plans,
}: {
  memberId: string;
  plans: Plan[];
}) {
  if (plans.length === 0) {
    return (
      <p className="font-mono text-xs text-ink-mute">No plans yet.</p>
    );
  }
  return (
    <div className="space-y-8">
      {plans.map((plan) => {
        const doneCount = plan.items.filter(
          (i) => i.outcome === 'DONE_EASY' || i.outcome === 'DONE_HARD' || i.outcome === 'SKIPPED',
        ).length;
        const skippedCount = plan.items.filter((i) => i.outcome === 'SKIPPED').length;
        const href = `/admin/member/${memberId}/plan/${plan.planId}`;
        return (
          <article key={plan.planId} className="space-y-3">
            <header className="flex flex-wrap items-center gap-3">
              <Link
                href={href}
                className="group font-serif-tool text-lg font-semibold text-ink hover:text-focus"
              >
                Week of {formatDate(plan.weekStart)}
                <span className="ml-1 font-sans text-xs font-normal text-ink-faint transition-colors group-hover:text-focus">
                  →
                </span>
              </Link>
              <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                {plan.status} · {doneCount}/{plan.items.length}
                {skippedCount > 0 && (
                  <span className="ml-1 normal-case text-xs text-ink-mute">({skippedCount} skipped)</span>
                )}
              </span>
              <Link
                href={href}
                className="ml-auto inline-flex items-center gap-1 rounded-pill bg-paper-warm px-3 py-1 font-mono text-[10px] uppercase tracking-label text-ink-soft hover:bg-rule hover:text-ink"
              >
                <Pencil className="h-3 w-3" strokeWidth={1.5} />
                Open editor
              </Link>
            </header>
            <ul className="space-y-2">
              {plan.items.map((item) => (
                <li
                  key={item.id}
                  className="border border-rule rounded-card p-3 bg-surface"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={clsx(
                        'mt-1.5 inline-block h-2 w-2 rounded-full',
                        DOT_BY_OUTCOME[item.outcome],
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-serif-tool text-sm font-semibold text-ink">
                        {item.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-ink-mute">
                        <span>{item.outcome.replace('_', ' ').toLowerCase()}</span>
                        {item.topicLabel && (
                          <>
                            <span>·</span>
                            <span>{item.topicLabel}</span>
                          </>
                        )}
                      </div>
                      {item.reflection && (
                        <p className="mt-2 font-serif italic text-sm text-ink-soft">
                          &ldquo;{item.reflection}&rdquo;
                        </p>
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
