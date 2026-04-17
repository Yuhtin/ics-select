'use client';

import { use } from 'react';
import { useMeItem } from '../../../../../lib/queries/me-item';
import { ItemFocus } from '../../../../../components/member/item-focus';

export default function MeItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useMeItem(id);
  if (isLoading) return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>;
  if (error || !data) return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Item not found.</p>;
  return <ItemFocus item={data} />;
}
