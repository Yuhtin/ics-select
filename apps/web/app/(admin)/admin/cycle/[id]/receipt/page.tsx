import { ReceiptClient } from './receipt-client';

export default function ReceiptPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { asOf?: string; mode?: 'thermal' | 'wrapped' };
}) {
  return (
    <ReceiptClient
      cycleId={params.id}
      asOf={searchParams.asOf}
      modeOverride={searchParams.mode}
    />
  );
}
