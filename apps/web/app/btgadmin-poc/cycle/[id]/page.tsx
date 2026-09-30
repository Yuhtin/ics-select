'use client';
import { use } from 'react';
import { BtgCycle } from '../../../../btg/admin/cycle';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BtgCycle id={id} />;
}
