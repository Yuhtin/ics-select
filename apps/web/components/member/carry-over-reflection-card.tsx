'use client';

import type { CarryOverReflection } from '../../lib/queries/me-home';

interface Props {
  reflection: CarryOverReflection;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CarryOverReflectionCard({ reflection }: Props) {
  return (
    <aside className="relative overflow-hidden rounded-tile border border-border-token bg-surface p-6 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-reflect">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-reflect">
        Carried over · your note, {formatRelative(reflection.submittedAt)}
      </p>
      <blockquote className="mt-3 max-w-[58ch] font-serif text-lg italic leading-[1.45] text-fg-soft">
        &ldquo;{reflection.reflection}&rdquo;
      </blockquote>
      <p className="mt-3 font-sans text-xs text-fg-mute">
        on {reflection.title}
      </p>
    </aside>
  );
}
