'use client';
import { useMeRetroCurrent } from '../../../../lib/queries/me-retro';
import { RetroForm } from '../../../../components/member/retro-form';
import { StudioPageHeader } from '../../../../components/member/studio-page-header';

export default function MeRetroPage() {
  const { data, isError } = useMeRetroCurrent();
  if (!data) {
    return (
      <section className="max-w-4xl">
        <StudioPageHeader eyebrow="Weekly retro" title="How was this week?" />
        <p role={isError ? 'alert' : 'status'} className="py-8 text-sm text-fg-soft">
          {isError ? 'Could not load your retro.' : 'Loading…'}
        </p>
      </section>
    );
  }
  return <RetroForm data={data} />;
}
