'use client';
import type { CycleReceiptResponse } from '../../../lib/queries/admin-cycle-receipt';

export function ThermalReceiptView(_: { data: CycleReceiptResponse }) {
  return <div className="p-12 font-mono text-sm">Thermal Receipt (stub)</div>;
}
