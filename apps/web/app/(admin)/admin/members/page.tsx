'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useAdminMembers } from '../../../../lib/queries/admin-members-list';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { clsx } from 'clsx';

function Initials({
  name,
  pictureUrl,
  size = 36,
}: {
  name: string;
  pictureUrl: string | null;
  size?: number;
}) {
  if (pictureUrl) {
    return (
      <img
        src={pictureUrl}
        alt=""
        className="rounded-full object-cover border border-rule"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-paper-warm border border-rule font-serif text-ink text-sm font-semibold"
      style={{ width: size, height: size }}
    >
      {initials || '—'}
    </span>
  );
}

export default function AdminMembersPage() {
  const { data, isLoading } = useAdminMembers();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <div className="max-w-5xl space-y-8">
      <header>
        <Eyebrow>Members</Eyebrow>
        <h1 className="mt-2 font-serif-tool text-3xl font-semibold tracking-tight">
          Members
        </h1>
        <p className="mt-1 font-mono text-xs text-ink-mute">
          {data ? `${data.length} total` : 'Loading…'}
        </p>
      </header>

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint"
          strokeWidth={1.5}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full rounded-input border border-rule bg-paper pl-9 pr-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
        />
      </div>

      {isLoading ? (
        <p className="font-mono text-xs uppercase tracking-label text-ink-mute">
          Loading…
        </p>
      ) : filtered.length === 0 ? (
        <p className="font-mono text-xs text-ink-mute py-12 text-center border border-dashed border-rule rounded-card">
          No members match.
        </p>
      ) : (
        <ul className="divide-y divide-rule border border-rule rounded-card bg-surface">
          {filtered.map((m) => (
            <li key={m.id}>
              <Link
                href={`/admin/member/${m.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-paper-warm/60 transition-colors"
              >
                <Initials name={m.name} pictureUrl={m.pictureUrl} />
                <div className="flex-1 min-w-0">
                  <p className="font-serif-tool text-base font-semibold text-ink">
                    {m.name}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                    {m.email}
                  </p>
                </div>
                <span
                  className={clsx(
                    'font-mono text-[10px] uppercase tracking-label px-2 py-0.5 rounded-pill border',
                    m.role === 'ADMIN'
                      ? 'text-accent border-accent/40'
                      : 'text-ink-mute border-rule',
                  )}
                >
                  {m.role}
                </span>
                <div className="hidden md:flex items-center gap-4 font-mono text-[11px] text-ink-mute tabular-nums">
                  <span>{m.stats.plansCount} plans</span>
                  <span className="text-outcome-done-easy">{m.stats.doneItems} done</span>
                  {m.stats.stuckItems > 0 && (
                    <span className="text-outcome-stuck">
                      {m.stats.stuckItems} stuck
                    </span>
                  )}
                </div>
                <span className="font-mono text-xs text-ink-mute">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
