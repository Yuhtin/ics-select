'use client';

import { useState } from 'react';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { WaitlistStats } from '../../../../components/admin/waitlist/waitlist-stats';
import { WaitlistFilters } from '../../../../components/admin/waitlist/waitlist-filters';
import { WaitlistTable } from '../../../../components/admin/waitlist/waitlist-table';
import { WaitlistExportButton } from '../../../../components/admin/waitlist/waitlist-export-button';
import { useWaitlistConfig, useWaitlistList } from '../../../../lib/queries/waitlist';
import type { WaitlistFilters as Filters } from '../../../../lib/waitlist/api';

export default function AdminWaitlistPage() {
  const [filters, setFilters] = useState<Filters>({ page: 1, pageSize: 50 });
  const { data, isLoading } = useWaitlistList(filters);
  const { data: config } = useWaitlistConfig();
  const cycleLabel = config?.cycleTarget ? `Ciclo ${config.cycleTarget}` : 'Próximo ciclo';

  return (
    <div className="max-w-6xl space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <Eyebrow>Waitlist · {cycleLabel}</Eyebrow>
          <h1 className="mt-3 font-serif-tool text-4xl font-semibold tracking-tight leading-tight">
            Inscritos
          </h1>
        </div>
        <WaitlistExportButton />
      </header>

      <WaitlistStats />

      <WaitlistFilters value={filters} onChange={setFilters} />

      <section>
        {isLoading ? (
          <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>
        ) : (
          <>
            <WaitlistTable rows={data?.items ?? []} />
            {data && data.total > data.pageSize && (
              <div className="flex items-center justify-between pt-4 font-mono text-xs text-ink-mute">
                <span>
                  {((filters.page ?? 1) - 1) * (filters.pageSize ?? 50) + 1}
                  –
                  {Math.min((filters.page ?? 1) * (filters.pageSize ?? 50), data.total)}
                  {' '}de {data.total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters({ ...filters, page: Math.max(1, (filters.page ?? 1) - 1) })}
                    disabled={(filters.page ?? 1) <= 1}
                    className="px-3 py-1 border border-rule rounded-full disabled:opacity-40 hover:border-ink transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) + 1 })}
                    disabled={(filters.page ?? 1) * (filters.pageSize ?? 50) >= data.total}
                    className="px-3 py-1 border border-rule rounded-full disabled:opacity-40 hover:border-ink transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
