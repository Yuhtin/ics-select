'use client';
import { useCycleReceipt } from '../../../../../../lib/queries/admin-cycle-receipt';
import { ReceiptToolbar } from '../../../../../../components/admin/receipt/receipt-toolbar';
import { ThermalReceiptView } from '../../../../../../components/admin/receipt/thermal-receipt-view';
import { WrappedView } from '../../../../../../components/admin/receipt/wrapped-view';
import { ApiErrorResponse } from '../../../../../../lib/api/client';

type Props = {
  cycleId: string;
  asOf?: string;
  modeOverride?: 'thermal' | 'wrapped';
};

export function ReceiptClient({ cycleId, asOf, modeOverride }: Props) {
  const { data, isLoading, error } = useCycleReceipt(cycleId, asOf);

  if (isLoading) {
    return (
      <div className="p-12 font-mono text-sm text-ink-mute">Loading receipt…</div>
    );
  }
  if (error || !data) {
    const apiError = error instanceof ApiErrorResponse ? error.apiError : null;
    const code = apiError?.code;
    const message =
      code === 'CYCLE_NOT_STARTED'
        ? "Cycle hasn't started yet."
        : code === 'INVALID_AS_OF'
          ? 'That date is outside the cycle range.'
          : 'Failed to load receipt.';
    return <div className="p-12 font-mono text-sm text-ink-mute">{message}</div>;
  }

  const mode = modeOverride ?? data.mode;
  return (
    <>
      <ReceiptToolbar data={data} mode={mode} />
      {mode === 'wrapped' ? <WrappedView data={data} /> : <ThermalReceiptView data={data} />}
    </>
  );
}
