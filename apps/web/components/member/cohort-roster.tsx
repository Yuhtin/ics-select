'use client';

import { useMemo, useState } from 'react';
import { Copy, Mail, Search } from 'lucide-react';
import { clsx } from 'clsx';
import type { CohortMember } from '../../lib/queries/me-cohort';

interface Props {
  members: CohortMember[];
}

function Initials({
  name,
  pictureUrl,
  size = 44,
}: {
  name: string;
  pictureUrl: string | null;
  size?: number;
}) {
  if (pictureUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={pictureUrl}
        alt=""
        className="rounded-full border border-border-token object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border border-border-token bg-bg-subtle font-sans text-sm font-semibold text-fg-soft"
      style={{ width: size, height: size }}
    >
      {initials || '—'}
    </span>
  );
}

export function CohortRoster({ members }: Props) {
  const [query, setQuery] = useState('');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    );
  }, [members, query]);

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail((cur) => (cur === email ? null : cur)), 1500);
    } catch {
      // Clipboard blocked — silent, the email is visible anyway.
    }
  };

  if (members.length === 0) {
    return (
      <p className="font-mono text-xs text-fg-mute">No classmates to show.</p>
    );
  }

  return (
    <section className="rounded-tile border border-border-token bg-surface">
      <header className="flex items-center gap-3 border-b border-border-token px-5 py-4">
        <div className="flex-1">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
            Classmates
          </p>
          <p className="mt-0.5 font-sans text-sm text-fg-soft">
            {members.length} on this cycle
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint"
            strokeWidth={1.6}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            className="w-full rounded-input border border-border-strong bg-surface py-2 pl-9 pr-3 font-sans text-sm text-fg transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </header>
      <ul role="list" className="divide-y divide-border-token">
        {filtered.map((m) => (
          <li
            key={m.userId}
            className={clsx(
              'flex items-center gap-4 px-5 py-3',
              m.isMe && 'bg-primary-soft',
            )}
          >
            <Initials name={m.name} pictureUrl={m.pictureUrl} />
            <div className="flex-1 min-w-0">
              <p className="flex items-center gap-2 font-sans text-sm font-medium text-fg">
                {m.name}
                {m.isMe && (
                  <span className="inline-flex h-[18px] items-center rounded-pill bg-primary px-2 font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-primary-fg">
                    You
                  </span>
                )}
              </p>
              <p className="mt-0.5 truncate font-mono text-[12px] text-fg-mute">
                {m.email}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <a
                href={`mailto:${m.email}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-input text-fg-mute transition-colors hover:bg-bg-subtle hover:text-fg"
                aria-label={`Email ${m.name}`}
                title={`Email ${m.name}`}
              >
                <Mail className="h-4 w-4" strokeWidth={1.6} />
              </a>
              <button
                type="button"
                onClick={() => copyEmail(m.email)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-input text-fg-mute transition-colors hover:bg-bg-subtle hover:text-fg"
                aria-label={`Copy ${m.name}'s email`}
                title={
                  copiedEmail === m.email ? 'Copied!' : `Copy email`
                }
              >
                <Copy className="h-4 w-4" strokeWidth={1.6} />
              </button>
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-5 py-6 text-center font-mono text-xs text-fg-mute">
            No classmates match “{query}”.
          </li>
        )}
      </ul>
    </section>
  );
}
