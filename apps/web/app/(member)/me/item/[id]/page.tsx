'use client';

import { use } from 'react';
import { useMeItem } from '../../../../../lib/queries/me-item';
import { ItemFocus } from '../../../../../components/member/item-focus';

export default function MeItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useMeItem(id);
  if (isLoading) return <section role="status" className="max-w-[800px] border-b border-border-token py-8 font-sans text-sm text-fg-mute">Loading…</section>;
  if (error || !data) return <section role="alert" className="max-w-[800px] border-b border-border-token py-8 font-sans text-sm text-fg-mute">Item not found.</section>;
  return <ItemFocus item={data} />;
}
