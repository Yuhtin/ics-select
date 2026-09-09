'use client';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { toPng } from 'html-to-image';
import { ChevronLeft, Download } from 'lucide-react';
import type {
  CycleReceiptResponse,
  ReceiptMode,
} from '../../../lib/queries/admin-cycle-receipt';

function daysBetween(a: string, b: string) {
  const ta = new Date(`${a}T00:00:00Z`).getTime();
  const tb = new Date(`${b}T00:00:00Z`).getTime();
  return Math.abs(tb - ta) / (24 * 60 * 60 * 1000);
}

export function ReceiptToolbar({
  data,
  mode,
}: {
  data: CycleReceiptResponse;
  mode: ReceiptMode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const cycle = data.cycle;
  const asOfValue = (sp.get('asOf') ?? data.asOf).slice(0, 10);
  const minDate = cycle.startsAt.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const endDate = cycle.endsAt.slice(0, 10);
  const maxDate = today < endDate ? today : endDate;

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const showModeToggle =
    mode === 'wrapped' ||
    cycle.status === 'ARCHIVED' ||
    daysBetween(asOfValue, endDate) <= 2;

  const handleDownload = useCallback(async () => {
    const target = document.getElementById('receipt-capture-root');
    if (!target) return;
    const dataUrl = await toPng(target, { pixelRatio: 2, backgroundColor: '#FCFCFB' });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `cycle-${cycle.id.slice(-6)}-receipt-${asOfValue}.png`;
    a.click();
  }, [cycle.id, asOfValue]);

  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-border-token bg-surface px-6 py-3 print:hidden">
      <Link
        href={`/admin/cycle/${cycle.id}`}
        className="inline-flex min-h-10 items-center gap-1 font-sans text-sm text-fg-soft hover:text-fg rounded-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
        Back to cycle
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 font-sans text-sm text-fg-mute">
          As of
          <input
            type="date"
            value={asOfValue}
            min={minDate}
            max={maxDate}
            onChange={(e) => updateParam('asOf', e.target.value)}
            className="min-h-10 rounded-input border border-border-token bg-bg px-3 py-2 font-mono text-xs text-fg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>

        {showModeToggle && (
          <button
            type="button"
            onClick={() => updateParam('mode', mode === 'wrapped' ? 'thermal' : 'wrapped')}
            className="min-h-10 rounded-pill border border-border-token px-4 py-2 font-sans text-sm text-fg-soft hover:bg-bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {mode === 'wrapped' ? 'Switch to thermal' : 'Switch to wrapped'}
          </button>
        )}

        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex min-h-10 items-center gap-2 rounded-pill bg-primary px-4 py-2 font-sans text-sm font-medium text-primary-fg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
          Download PNG
        </button>
      </div>
    </div>
  );
}
