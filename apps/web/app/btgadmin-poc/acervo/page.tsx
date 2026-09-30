import { Suspense } from 'react';
import { BtgLibrary } from '../../../btg/admin/library';
import { Loading } from '../../../btg/ui';

// useSearchParams (filters live in the URL) needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <BtgLibrary />
    </Suspense>
  );
}
