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
            <table className="w-full border-collapse">
              <tbody>
                {plan.items.map((item) => (
                  <tr key={item.id} className="border-b border-rule/60 hover:bg-paper-warm/40">
                    <td className="py-2 pr-3 w-3 align-middle">
                      <span className={clsx('inline-block w-2 h-2 rounded-full', dotColor(item.outcome))} />
                    </td>
                    <td className="py-2 pr-4 font-serif text-[14px] text-ink truncate max-w-md align-middle">
                      {item.title}
                    </td>
                    <td className="py-2 pr-4 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute align-middle">
                      {item.outcome.toLowerCase().replace('_', ' ')}
                    </td>
                    <td className="py-2 pr-4 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute align-middle">
                      {item.topicLabel ?? '—'}
                    </td>
                    <td className="py-2 text-right align-middle">
                      <Link
                        href={`/me/item/${item.libraryItemId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink-mute hover:text-ink inline-flex"
                      >
                        <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        );
      })}
    </div>
  );
}
