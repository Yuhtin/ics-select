'use client';

import { useRouter } from 'next/navigation';
import type { HomeItem } from '../../lib/queries/me-home';
import { ListRow } from '../ui/list-row';
import { DayHeader } from '../ui/day-header';
import { formatTimeUtc, formatMinutes } from '../../lib/format/time';
import { platformLabel, detectPlatform } from '../../lib/format/platform';

interface DayListProps {
  label: string;
  hint?: string;
  items: HomeItem[];
  activeItemId?: string | null;
}

export function DayList({ label, hint, items, activeItemId }: DayListProps) {
  const router = useRouter();
  return (
    <div>
      <DayHeader label={label} hint={hint} />
      {items.length === 0 ? (
        <p className="py-4 font-sans text-sm text-ink-mute">Nothing scheduled.</p>
      ) : (
        items.map((item) => {
          const platform = detectPlatform(item.url, item.format);
          const meta = `${platformLabel(platform).toUpperCase()} · ${formatMinutes(item.estimatedMinutes).toUpperCase()}`;
          return (
            <ListRow
              key={item.id}
              time={formatTimeUtc(item.scheduledAt) ?? undefined}
              outcome={item.outcome}
              active={activeItemId === item.id}
              title={item.title}
              meta={meta}
              onClick={() => router.push(`/me/item/${item.id}`)}
            />
          );
        })
      )}
    </div>
  );
}
