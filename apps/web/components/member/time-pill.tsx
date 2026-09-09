'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { minutesToHHMM } from '../../lib/format/time';

const EASE = [0.16, 1, 0.3, 1] as const;

type Props = {
  value: number; // minutes from 00:00
  onChange: (minutes: number) => void;
  /** Exclusive lower bound — any time <= this is disabled. Used for end pickers. */
  minMinuteExclusive?: number;
  /** Exclusive upper bound — any time >= this is disabled. Used for start pickers. */
  maxMinuteExclusive?: number;
  /** If true, adds a "End of day (24:00)" footer button that commits 1440. */
  allowEndOfDay?: boolean;
  ariaLabel: string;
};

export function TimePill({
  value,
  onChange,
  minMinuteExclusive,
  maxMinuteExclusive,
  allowEndOfDay = false,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [draftHour, setDraftHour] = useState<number>(Math.floor(value / 60));
  const [coords, setCoords] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Reset draft hour whenever popover opens to reflect current value
  useEffect(() => {
    if (open) setDraftHour(Math.floor(value / 60));
  }, [open, value]);

  // Use the visible viewport, including pinch zoom and the on-screen keyboard.
  // When neither side fits, use the larger side and scroll within the panel.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const viewport = window.visualViewport;
    const position = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      const margin = 8;
      const gap = 6;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const width = Math.min(312, viewportWidth - margin * 2);
      const fullHeight = popoverRef.current
        ? popoverRef.current.scrollHeight + 2
        : allowEndOfDay ? 384 : 324;
      const spaceBelow = viewportTop + viewportHeight - margin - rect.bottom - gap;
      const spaceAbove = rect.top - viewportTop - margin - gap;
      const below = spaceBelow >= fullHeight || spaceBelow >= spaceAbove;
      const maxHeight = Math.min(viewportHeight - margin * 2, Math.max(44, below ? spaceBelow : spaceAbove));
      const height = Math.min(fullHeight, maxHeight);
      const top = Math.max(viewportTop + margin, Math.min(
        below ? rect.bottom + gap : rect.top - gap - height,
        viewportTop + viewportHeight - margin - height,
      ));
      const left = Math.max(viewportLeft + margin, Math.min(rect.left, viewportLeft + viewportWidth - margin - width));
      setCoords({ left, top, width, maxHeight });
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && popoverRef.current?.contains(event.target)) return;
      position();
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', onScroll, true);
    viewport?.addEventListener('resize', position);
    viewport?.addEventListener('scroll', position);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', onScroll, true);
      viewport?.removeEventListener('resize', position);
      viewport?.removeEventListener('scroll', position);
    };
  }, [open, allowEndOfDay, coords?.width]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function commit(nextMinutes: number) {
    onChange(nextMinutes);
    setOpen(false);
  }

  function isTimeAllowed(m: number) {
    if (minMinuteExclusive !== undefined && m <= minMinuteExclusive) return false;
    if (maxMinuteExclusive !== undefined && m >= maxMinuteExclusive) return false;
    return true;
  }

  function isHourAllowed(h: number) {
    // Hour allowed if any of its 30-min slots is allowed
    return isTimeAllowed(h * 60) || isTimeAllowed(h * 60 + 30);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={clsx(
          'inline-flex h-11 min-w-[84px] items-center justify-between gap-1.5 rounded-input border bg-surface px-3 font-mono text-[13px] tabular-nums text-fg transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          open
            ? 'border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]'
            : 'border-border-token hover:border-border-strong',
        )}
      >
        <span>{minutesToHHMM(value)}</span>
        <ChevronDown
          className={clsx(
            'h-3.5 w-3.5 text-fg-mute transition-transform',
            open && 'rotate-180 text-fg-soft',
          )}
          strokeWidth={1.8}
        />
      </button>

      {mounted && coords &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={popoverRef}
                role="dialog"
                aria-label={`${ariaLabel} picker`}
                initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: reduceMotion ? 0 : 0.16, ease: EASE }}
                style={{
                  position: 'fixed',
                  left: coords.left,
                  top: coords.top,
                  width: coords.width,
                  maxHeight: coords.maxHeight,
                  zIndex: 50,
                }}
                className="origin-top overflow-y-auto overscroll-contain rounded-card border border-border-token bg-surface p-3 shadow-lg"
              >
                <div>
                  <p className="mb-2 font-sans text-xs font-medium text-fg-mute">
                    Hour
                  </p>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(44px,1fr))] gap-1">
                    {Array.from({ length: 24 }, (_, h) => {
                      const allowed = isHourAllowed(h);
                      const isSelected = h === draftHour;
                      return (
                        <button
                          key={h}
                          type="button"
                          disabled={!allowed}
                          aria-label={`Hour ${String(h).padStart(2, '0')}`}
                          onClick={() => {
                            setDraftHour(h);
                            // If current minute invalid for this hour, snap up and commit
                            const current = h * 60 + (value % 60);
                            if (!isTimeAllowed(current)) {
                              const alt = h * 60;
                              const alt2 = h * 60 + 30;
                              if (isTimeAllowed(alt)) commit(alt);
                              else if (isTimeAllowed(alt2)) commit(alt2);
                            }
                          }}
                          className={clsx(
                            'h-11 min-w-11 rounded-input font-mono text-[12px] tabular-nums transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            !allowed && 'cursor-not-allowed text-fg-mute',
                            allowed && isSelected && 'bg-primary text-primary-fg',
                            allowed && !isSelected &&
                              'text-fg-soft hover:bg-bg-subtle hover:text-fg',
                          )}
                        >
                          {String(h).padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="mb-2 font-sans text-xs font-medium text-fg-mute">
                    Minute
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[0, 30].map((m) => {
                      const total = draftHour * 60 + m;
                      const allowed = isTimeAllowed(total);
                      const isSelected = total === value;
                      return (
                        <button
                          key={m}
                          type="button"
                          disabled={!allowed}
                          aria-label={`Minute ${String(m).padStart(2, '0')}`}
                          onClick={() => commit(total)}
                          className={clsx(
                            'h-11 rounded-input border font-mono text-[13px] font-semibold tabular-nums transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            !allowed &&
                              'cursor-not-allowed border-border-token/60 text-fg-mute',
                            allowed && isSelected &&
                              'border-primary bg-primary text-primary-fg',
                            allowed && !isSelected &&
                              'border-border-token bg-surface text-fg-soft hover:border-border-strong hover:text-fg',
                          )}
                        >
                          :{String(m).padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {allowEndOfDay && (
                  <button
                    type="button"
                    disabled={!isTimeAllowed(1440)}
                    onClick={() => commit(1440)}
                    className={clsx(
                      'mt-4 flex min-h-11 w-full items-center justify-between rounded-[8px] border px-3 py-2 font-sans text-[12px] transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      !isTimeAllowed(1440)
                        ? 'cursor-not-allowed border-border-token/60 text-fg-mute'
                        : value === 1440
                          ? 'border-primary bg-primary text-primary-fg'
                          : 'border-border-token text-fg-soft hover:border-border-strong hover:text-fg',
                    )}
                  >
                    <span>End of day</span>
                    <span className="font-mono tabular-nums">24:00</span>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
