import { ReceiptClient } from './receipt-client';

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ asOf?: string; mode?: 'thermal' | 'wrapped' }>;
}) {
  const { id } = await params;
  const { asOf, mode } = await searchParams;
  return <ReceiptClient cycleId={id} asOf={asOf} modeOverride={mode} />;
}
