'use client';
import Link from 'next/link';
import { ExternalLink, Pencil } from 'lucide-react';
import { clsx } from 'clsx';
import type { MemberDetailResponse } from '../../../lib/queries/admin-member';

type Plan = MemberDetailResponse['timeline'][number];

function dotColor(outcome: string): string {
  switch (outcome) {
    case 'DONE_EASY': return 'bg-outcome-done-easy';
    case 'DONE_HARD': return 'bg-outcome-done-hard';
    case 'DOUBTS':    return 'bg-outcome-doubts';
    case 'STUCK':     return 'bg-outcome-stuck';
    default:          return 'bg-outcome-pending';
  }
}

function noteAccent(outcome: string): { border: string; eyebrow: string; label: string } {
  switch (outcome) {
    case 'STUCK':
      return { border: 'border-outcome-stuck', eyebrow: 'text-outcome-stuck', label: 'Stuck — needs help' };
    case 'DOUBTS':
      return { border: 'border-outcome-doubts', eyebrow: 'text-outcome-doubts', label: 'Had doubts' };
    default:
      return { border: 'border-border-token', eyebrow: 'text-fg-mute', label: 'Member note' };
  }
}

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
      <p className="font-sans text-xs text-fg-mute">No plans yet.</p>
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
                className="group font-sans text-lg font-semibold text-fg hover:text-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                Week of {formatDate(plan.weekStart)}
                <span className="ml-1 font-sans text-xs font-normal text-fg-mute transition-colors group-hover:text-focus">
                  →
                </span>
              </Link>
              <span className="font-sans text-xs text-fg-mute">
                {plan.status} · {doneCount}/{plan.items.length}
                {skippedCount > 0 && (
                  <span className="ml-1 normal-case text-xs text-fg-mute">({skippedCount} skipped)</span>
                )}
              </span>
              <Link
                href={href}
                className="ml-auto inline-flex items-center gap-1 rounded-pill bg-bg-subtle px-3 py-1 font-sans text-xs text-fg-soft hover:bg-surface-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <Pencil className="h-3 w-3" strokeWidth={1.5} />
                Open editor
              </Link>
            </header>
            <ul className="divide-y divide-border-token/60">
              {plan.items.map((item) => {
                const accent = noteAccent(item.outcome);
                return (
                  <li key={item.id} className="py-2.5 hover:bg-bg-subtle/40">
                    <div className="flex items-center gap-3">
                      <span className={clsx('inline-block w-2 h-2 rounded-full shrink-0', dotColor(item.outcome))} />
                      <span className="font-sans text-[14px] text-fg truncate min-w-0 flex-1">
                        {item.title}
                      </span>
                      <span className="hidden sm:inline font-sans text-xs text-fg-mute shrink-0">
                        {item.outcome.toLowerCase().replace('_', ' ')}
                      </span>
                      <span className="hidden md:inline font-sans text-xs text-fg-mute shrink-0">
                        {item.topicLabel ?? '—'}
                      </span>
                      <Link
                        href={`/me/item/${item.libraryItemId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-fg-mute hover:text-fg inline-flex shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      >
                        <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </Link>
                    </div>
                    {item.reflection && (
                      <div className={clsx('ml-5 mt-1.5 border-l-[3px] pl-3', accent.border)}>
                        <p className={clsx('font-sans text-xs mb-0.5', accent.eyebrow)}>
                          {accent.label}
                        </p>
                        <p className="font-sans text-[13px] italic text-fg-soft leading-snug whitespace-pre-wrap break-words">
                          &ldquo;{item.reflection}&rdquo;
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
