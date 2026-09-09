'use client';
import { useMeRetroCurrent } from '../../../../lib/queries/me-retro';
import { RetroForm } from '../../../../components/member/retro-form';

export default function MeRetroPage() {
  const { data, isLoading } = useMeRetroCurrent();
  if (isLoading || !data) {
    return <p className="font-sans text-sm text-fg-mute">Loading…</p>;
  }
  return <RetroForm data={data} />;
}
