'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
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
  const [mounted, setMounted] = useState(false);
  const [draftHour, setDraftHour] = useState<number>(Math.floor(value / 60));
  const [coords, setCoords] = useState<{ left: number; top: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Reset draft hour whenever popover opens to reflect current value
  useEffect(() => {
    if (open) setDraftHour(Math.floor(value / 60));
  }, [open, value]);

  // Position popover below (or above if no room) button
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const POPOVER_MAX_H = 320;
    const POPOVER_W = 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < POPOVER_MAX_H + 12 && rect.top > POPOVER_MAX_H + 12
        ? rect.top - POPOVER_MAX_H - 8
        : rect.bottom + 6;
    let left = rect.left;
    if (left + POPOVER_W > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - POPOVER_W - 8);
    }
    setCoords({ left, top, width: POPOVER_W });
  }, [open]);

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
          'inline-flex h-9 min-w-[84px] items-center justify-between gap-1.5 rounded-input border bg-surface px-3 font-mono text-[13px] tabular-nums text-fg transition-colors',
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
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.16, ease: EASE }}
                style={{
                  position: 'fixed',
                  left: coords.left,
                  top: coords.top,
                  width: coords.width,
                  zIndex: 50,
                }}
                className="origin-top rounded-card border border-border-token bg-surface p-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)]"
              >
                <div>
                  <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
                    Hour
                  </p>
                  <div className="grid grid-cols-6 gap-1">
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
                            'h-8 rounded-[6px] font-mono text-[12px] tabular-nums transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            !allowed && 'cursor-not-allowed text-fg-faint',
                            allowed && isSelected && 'bg-fg text-bg',
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
                  <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
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
                            'h-10 rounded-[8px] border font-mono text-[13px] font-semibold tabular-nums transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            !allowed &&
                              'cursor-not-allowed border-border-token/60 text-fg-faint',
                            allowed && isSelected &&
                              'border-fg bg-fg text-bg',
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
                      'mt-4 flex w-full items-center justify-between rounded-[8px] border px-3 py-2 font-sans text-[12px] transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      !isTimeAllowed(1440)
                        ? 'cursor-not-allowed border-border-token/60 text-fg-faint'
                        : value === 1440
                          ? 'border-fg bg-fg text-bg'
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
