'use client';
import { Suspense, use } from 'react';
import { BtgReceipt } from '../../../../../btg/admin/receipt';
import { Loading } from '../../../../../btg/ui';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<Loading />}>
      <BtgReceipt cycleId={id} />
    </Suspense>
  );
}
