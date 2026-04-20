'use client';

import { useRef, useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AdminLibraryItem } from '../../lib/queries/admin-library';
import { LibraryCard, type Capability } from './library-card';

interface Props {
  label: string;
  items: AdminLibraryItem[];
  capability: Capability;
  onEdit?: (item: AdminLibraryItem) => void;
  onDelete?: (item: AdminLibraryItem) => void;
}

export function LibraryShelf({
  label,
  items,
  capability,
  onEdit,
  onDelete,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [items.length]);

  if (items.length === 0) return null;

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-lg font-semibold tracking-tight text-fg">
            {label}
          </h2>
          <span className="font-mono text-[11px] tabular-nums text-fg-mute">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="hidden items-center gap-1 md:flex">
          <ShelfNavButton
            onClick={() => scrollBy(-1)}
            disabled={!canScrollLeft}
            dir="left"
          />
          <ShelfNavButton
            onClick={() => scrollBy(1)}
            disabled={!canScrollRight}
            dir="right"
          />
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scroll-smooth py-6 pl-1 pr-1 [scrollbar-width:thin]"
          style={{ scrollSnapType: 'x proximity' }}
        >
          {items.map((item) => (
            <div key={item.id} style={{ scrollSnapAlign: 'start' }}>
              <LibraryCard
                item={item}
                capability={capability}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          ))}
        </div>
        <div
          className={clsx(
            'pointer-events-none absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-bg to-transparent transition-opacity',
            canScrollLeft ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          className={clsx(
            'pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-bg to-transparent transition-opacity',
            canScrollRight ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>
    </section>
  );
}

function ShelfNavButton({
  dir,
  onClick,
  disabled,
}: {
  dir: 'left' | 'right';
  onClick: () => void;
  disabled: boolean;
}) {
  const Icon = dir === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'left' ? 'Scroll left' : 'Scroll right'}
      className="grid h-7 w-7 place-items-center rounded-input border border-border-token text-fg-mute transition-colors hover:bg-bg-subtle hover:text-fg disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <Icon className="h-4 w-4" strokeWidth={1.8} />
    </button>
  );
}
