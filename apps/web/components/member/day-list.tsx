'use client';

import { useRouter } from 'next/navigation';
import type { HomeItem } from '../../lib/queries/me-home';
import { ListRow, type PlatformKey } from '../ui/list-row';
import { DayHeader } from '../ui/day-header';
import { formatTimeUtc, formatMinutes } from '../../lib/format/time';
import { platformLabel, detectPlatform } from '../../lib/format/platform';

interface DayListProps {
  label: string;
  hint?: string;
  items: HomeItem[];
  activeItemId?: string | null;
  /** Current time for "late" detection. Defaults to Date.now() at render. */
  now?: Date;
}

function intentFor(item: HomeItem, now: Date): 'default' | 'late' | 'carried' {
  if (item.carriedFromItemId) return 'carried';
  if (
    item.outcome === 'PENDING' &&
    item.scheduledAt &&
    new Date(item.scheduledAt).getTime() < now.getTime()
  ) {
    return 'late';
  }
  return 'default';
}

function badgeFor(intent: 'default' | 'late' | 'carried'): string | null {
  if (intent === 'late') return 'Late';
  if (intent === 'carried') return 'Carried over';
  return null;
}

export function DayList({ label, hint, items, activeItemId, now }: DayListProps) {
  const router = useRouter();
  const ref = now ?? new Date();
  return (
    <div>
      <DayHeader label={label} hint={hint} />
      {items.length === 0 ? (
        <p className="py-4 font-sans text-sm text-ink-mute">Nothing scheduled.</p>
      ) : (
        items.map((item) => {
          const platform = detectPlatform(item.url, item.format);
          const meta = `${platformLabel(platform).toUpperCase()} · ${formatMinutes(item.estimatedMinutes).toUpperCase()}`;
          const intent = intentFor(item, ref);
          const badge = badgeFor(intent);
          return (
            <ListRow
              key={item.id}
              time={formatTimeUtc(item.scheduledAt) ?? undefined}
              outcome={item.outcome}
              active={activeItemId === item.id}
              intent={intent}
              platform={platform as PlatformKey}
              title={item.title}
              meta={meta}
              badge={badge}
              onClick={() => router.push(`/me/item/${item.id}`)}
            />
          );
        })
      )}
    </div>
  );
}
