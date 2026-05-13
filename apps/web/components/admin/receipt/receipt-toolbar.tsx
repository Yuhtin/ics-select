'use client';
import type { CycleReceiptResponse, ReceiptMode } from '../../../lib/queries/admin-cycle-receipt';

export function ReceiptToolbar(_: { data: CycleReceiptResponse; mode: ReceiptMode }) {
  return <div className="sticky top-0 z-50 bg-paper p-4 font-mono text-xs">Toolbar (stub)</div>;
}
