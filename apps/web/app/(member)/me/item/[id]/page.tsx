'use client';

import { use } from 'react';
import { useMeItem } from '../../../../../lib/queries/me-item';
import { ItemFocus } from '../../../../../components/member/item-focus';

export default function MeItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useMeItem(id);
  if (isLoading) return <p className="font-sans text-sm text-fg-mute">Loading…</p>;
  if (error || !data) return <p className="font-sans text-sm text-fg-mute">Item not found.</p>;
  return <ItemFocus item={data} />;
}
