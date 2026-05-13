'use client';
import type { CycleReceiptResponse } from '../../../lib/queries/admin-cycle-receipt';

export function WrappedView(_: { data: CycleReceiptResponse }) {
  return <div className="p-12 font-mono text-sm">Wrapped (stub)</div>;
}
