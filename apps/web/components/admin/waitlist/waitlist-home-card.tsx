'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useWaitlistStats } from '../../../lib/queries/waitlist';
import { SectionLabel } from '../../ui/section-label';

export function WaitlistHomeCard() {
  const { data } = useWaitlistStats();
  if (!data) return null;

  return (
    <section>
      <SectionLabel>Waitlist</SectionLabel>
      <Link
        href="/admin/waitlist"
        className="group block border-t border-rule py-4 hover:bg-paper-warm transition-colors"
      >
        <div className="flex items-baseline justify-between gap-4">
          {data.total === 0 ? (
            <p className="font-serif-tool text-lg text-ink-soft">Nenhum inscrito ainda.</p>
          ) : (
            <p className="font-serif-tool text-lg text-ink">
              <span className="tabular-nums">{data.total}</span> inscrito{data.total === 1 ? '' : 's'}
              <span className="text-ink-mute"> · +{data.last7d} essa semana</span>
            </p>
          )}
          <ArrowRight className="w-4 h-4 text-ink-mute group-hover:text-ink" strokeWidth={1.5} />
        </div>
      </Link>
    </section>
  );
}
