'use client';
import { useState } from 'react';
import type { MemberDetailResponse } from '../../../lib/queries/admin-member';

type Retro = MemberDetailResponse['retros'][number];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function RetroBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="border-l-2 border-accent pl-4 py-2 bg-paper-warm/40">
      <p className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold">{label}</p>
      <p className="mt-1 font-serif-tool text-sm italic text-ink leading-relaxed">&ldquo;{text}&rdquo;</p>
    </div>
  );
}

export function RetrosTab({ retros }: { retros: Retro[] }) {
  const [openId, setOpenId] = useState<string | null>(retros[0]?.id ?? null);
  if (retros.length === 0) return <p className="font-mono text-xs text-ink-mute">No retros submitted yet.</p>;
  return (
    <div className="space-y-4">
      {retros.map((r) => {
        const open = openId === r.id;
        return (
          <article key={r.id} className="border border-rule rounded-card bg-surface">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : r.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-paper-warm/40 transition-colors"
            >
              <span className="font-serif-tool text-base font-semibold text-ink">Week of {formatDate(r.weekStart)}</span>
              <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                submitted {formatDate(r.submittedAt)} {open ? '−' : '+'}
              </span>
            </button>
            {open && (
              <div className="px-4 pb-4 space-y-3">
                {r.whatClicked && <RetroBlock label="What clicked" text={r.whatClicked} />}
                {r.whatStuck && <RetroBlock label="What stuck" text={r.whatStuck} />}
                {r.nextWeekWish && <RetroBlock label="Next week wish" text={r.nextWeekWish} />}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
