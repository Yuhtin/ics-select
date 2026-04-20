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
    <section className="space-y-1">
      <div className="flex items-baseline gap-3 px-1">
        <h2 className="font-sans text-[22px] font-bold leading-none tracking-[-0.01em] text-fg">
          {label}
        </h2>
        <span className="font-mono text-[10px] tabular-nums text-fg-faint">
          {items.length}
        </span>
      </div>

      <div className="group/shelf relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scroll-smooth pb-5 pl-1 pr-1 pt-2 [scrollbar-width:thin]"
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

        {/* Left edge nav — overlaid on cards, visible only when scrollable */}
        <ShelfEdgeNav
          dir="left"
          onClick={() => scrollBy(-1)}
          visible={canScrollLeft}
        />
        <ShelfEdgeNav
          dir="right"
          onClick={() => scrollBy(1)}
          visible={canScrollRight}
        />
      </div>
    </section>
  );
}

function ShelfEdgeNav({
  dir,
  onClick,
  visible,
}: {
  dir: 'left' | 'right';
  onClick: () => void;
  visible: boolean;
}) {
  const Icon = dir === 'left' ? ChevronLeft : ChevronRight;
  return (
    <div
      aria-hidden={!visible}
      className={clsx(
        'pointer-events-none absolute top-0 z-20 flex h-full w-[72px] items-center transition-opacity duration-200',
        dir === 'left'
          ? 'left-0 justify-start pl-1'
          : 'right-0 justify-end pr-1',
        // Subtle fade matching page bg, keeps cards visible underneath.
        dir === 'left'
          ? 'bg-gradient-to-r from-bg via-bg/75 to-transparent'
          : 'bg-gradient-to-l from-bg via-bg/75 to-transparent',
        visible
          ? 'opacity-100 md:opacity-0 md:group-hover/shelf:opacity-100 md:group-focus-within/shelf:opacity-100'
          : 'opacity-0',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={dir === 'left' ? 'Scroll left' : 'Scroll right'}
        tabIndex={visible ? 0 : -1}
        className={clsx(
          'pointer-events-auto grid h-14 w-11 place-items-center rounded-input bg-black/70 text-white shadow-xl backdrop-blur transition-all duration-200 hover:scale-[1.08] hover:bg-black/85 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        )}
      >
        <Icon className="h-6 w-6" strokeWidth={2.2} />
      </button>
    </div>
  );
}
