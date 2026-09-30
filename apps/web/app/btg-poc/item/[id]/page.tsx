'use client';
import { use } from 'react';
import { BtgItem } from '../../../../btg/member/item';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BtgItem id={id} />;
}
