'use client';

import Link from 'next/link';
import type { HomeItem } from '../../lib/queries/me-home';
import { OUTCOMES, platformOf, timeRange } from '../ui';
import { BTG_MEMBER_BASE } from './shell';

export function ItemRow({ item, activeId }: { item: HomeItem; activeId?: string | null }) {
  const platform = platformOf(item.url, item.format);
  const isNow = item.id === activeId;
  const status = isNow ? { label: 'Agora', color: 'var(--btg-primary)' } : OUTCOMES[item.outcome];
  return (
    <Link href={`${BTG_MEMBER_BASE}/item/${item.id}`} className="btg-row">
      <span className="btg-mono btg-soft btg-row-time" style={{ fontSize: 14 }}>
        {timeRange(item.scheduledAt, item.scheduledMinutes)}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span className="btg-stripe" style={{ background: platform.color }} />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span className="btg-row-title">{item.title}</span>
          <span className="btg-row-meta">
            {platform.label} · {item.estimatedMinutes} min
          </span>
        </div>
      </div>
      <span className="btg-row-meta btg-row-topic">{item.topic?.label ?? ''}</span>
      <span className="btg-row-status">
        <span className="btg-dot" style={{ background: status.color }} />
        <span className="btg-row-status-label">{status.label}</span>
      </span>
    </Link>
  );
}

export function ItemList({
  title,
  hint,
  items,
  activeId,
}: {
  title: string;
  hint?: string;
  items: HomeItem[];
  activeId?: string | null;
}) {
  return (
    <section className="btg-card">
      <div className="btg-card-head">
        <span className="btg-card-title">{title}</span>
        {hint && <span className="btg-mute" style={{ fontSize: 14 }}>{hint}</span>}
      </div>
      {items.length === 0 ? (
        <p className="btg-empty">Nada por aqui.</p>
      ) : (
        items.map((i) => <ItemRow key={i.id} item={i} activeId={activeId} />)
      )}
    </section>
  );
}
