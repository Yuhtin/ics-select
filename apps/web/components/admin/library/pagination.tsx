'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  page: number; // 1-based
  totalPages: number;
  onChange: (page: number) => void;
}

/**
 * Windowed pagination: shows first, last, current, and 2 on each side.
 * Renders ellipsis `…` where the window skips.
 */
export function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;
  const pages = windowedPages(page, totalPages);

  return (
    <nav className="flex items-center justify-center gap-1 pt-4" aria-label="Pagination">
      <PageButton
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria="Previous page"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
      </PageButton>
      {pages.map((p, i) =>
        p === null ? (
          <span
            key={`gap-${i}`}
            className="font-mono text-[11px] text-ink-mute px-1"
          >
            …
          </span>
        ) : (
          <PageButton
            key={p}
            active={p === page}
            onClick={() => onChange(p)}
            aria={`Page ${p}`}
          >
            {p}
          </PageButton>
        ),
      )}
      <PageButton
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria="Next page"
      >
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
      </PageButton>
    </nav>
  );
}

function PageButton({
  children,
  onClick,
  active,
  disabled,
  aria,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  aria: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-input font-mono text-[11px] transition-colors',
        active
          ? 'bg-ink text-paper'
          : 'text-ink-soft hover:bg-paper-warm disabled:opacity-40 disabled:hover:bg-transparent',
      )}
    >
      {children}
    </button>
  );
}

function windowedPages(page: number, total: number): Array<number | null> {
  const W = 1; // pages to show on each side of current
  const out: Array<number | null> = [];
  const add = (p: number) => {
    if (p < 1 || p > total) return;
    if (out[out.length - 1] !== p) out.push(p);
  };
  add(1);
  if (page - W > 2) out.push(null);
  for (let p = Math.max(2, page - W); p <= Math.min(total - 1, page + W); p++) {
    add(p);
  }
  if (page + W < total - 1) out.push(null);
  add(total);
  return out;
}
