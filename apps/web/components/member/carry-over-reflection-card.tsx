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
    <aside className="border-t border-border-token pt-6">
      <p className="font-sans text-xs font-medium text-fg-mute">
        Carried over · your note, {formatRelative(reflection.submittedAt)}
      </p>
      <blockquote className="mt-3 max-w-[58ch] font-sans text-base leading-relaxed text-fg-soft">
        &ldquo;{reflection.reflection}&rdquo;
      </blockquote>
      <p className="mt-3 font-sans text-xs text-fg-mute">
        on {reflection.title}
      </p>
    </aside>
  );
}
