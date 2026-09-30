import { Suspense } from 'react';
import { BtgPlansOverview } from '../../../btg/admin/plans-overview';
import { Loading } from '../../../btg/ui';

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <BtgPlansOverview />
    </Suspense>
  );
}
