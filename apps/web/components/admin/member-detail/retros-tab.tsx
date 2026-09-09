'use client';
import { useState } from 'react';
import type { MemberDetailResponse } from '../../../lib/queries/admin-member';

type Retro = MemberDetailResponse['retros'][number];

function formatDate(iso: string, inUtc = false): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(inUtc ? { timeZone: 'UTC' } : {}),
  });
}

function RetroBlock({
  label,
  text,
  linkedItem,
}: {
  label: string;
  text: string;
  linkedItem?: { id: string; title: string; outcome: string } | null;
}) {
  return (
    <div className="border-l-2 border-border-strong pl-4 py-2 bg-bg-subtle">
      <p className="font-sans text-xs text-fg-mute font-semibold">
        {label}
      </p>
      {linkedItem && (
        <p className="mt-1 font-sans text-xs text-fg-mute">
          → {linkedItem.title}
          <span className="ml-2 text-fg-mute">[{linkedItem.outcome}]</span>
        </p>
      )}
      <p className="mt-1 font-sans text-sm italic text-fg leading-relaxed">&ldquo;{text}&rdquo;</p>
    </div>
  );
}

export function RetrosTab({ retros }: { retros: Retro[] }) {
  const [openId, setOpenId] = useState<string | null>(retros[0]?.id ?? null);
  if (retros.length === 0) return <p className="font-sans text-xs text-fg-mute">No retros submitted yet.</p>;
  return (
    <div className="space-y-4">
      {retros.map((r) => {
        const open = openId === r.id;
        return (
          <article key={r.id} className="border border-border-token rounded-card bg-surface">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : r.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-subtle/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <span className="font-sans text-base font-semibold text-fg">Week of {formatDate(r.weekStart, true)}</span>
              <span className="font-sans text-xs text-fg-mute">
                submitted {formatDate(r.submittedAt)} {open ? '−' : '+'}
              </span>
            </button>
            {open && (
              <div className="px-4 pb-4 space-y-3">
                {r.whatClicked && (
                  <RetroBlock label="What clicked" text={r.whatClicked} linkedItem={r.valuedItem} />
                )}
                {r.whatStuck && (
                  <RetroBlock label="What stuck" text={r.whatStuck} linkedItem={r.stuckItem} />
                )}
                {r.nextWeekWish && <RetroBlock label="Next week wish" text={r.nextWeekWish} />}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
