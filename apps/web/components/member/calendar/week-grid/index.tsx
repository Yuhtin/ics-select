'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { clsx } from 'clsx';
import type { CalendarEvent } from '../../../../lib/queries/me-calendar';
import { localDateKeyFromDate } from './time';

export const WEEK_GRID_START_HOUR = 7;
export const WEEK_GRID_END_HOUR = 24; // exclusive upper — axis shows 07..23 then 00 at the bottom edge
export const HOUR_PX = 56;
const HOURS_VISIBLE = WEEK_GRID_END_HOUR - WEEK_GRID_START_HOUR;
const INITIAL_SCROLL_HOUR = 10;

interface WeekGridProps {
  weekStart: Date; // Sunday 00:00 local (as built in page.tsx)
  timezone: string;
  events: CalendarEvent[];
  onRescheduleClick: (event: CalendarEvent) => void;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function hourLabel(h: number): string {
  return String(h % 24).padStart(2, '0');
}

export function WeekGrid({
  weekStart,
  timezone: _timezone,
  events: _events,
  onRescheduleClick: _onRescheduleClick,
}: WeekGridProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const todayKey = useMemo(() => localDateKeyFromDate(new Date()), []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = (INITIAL_SCROLL_HOUR - WEEK_GRID_START_HOUR) * HOUR_PX;
  }, []);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  return (
    <div className="rounded-[12px] border border-border-token bg-surface overflow-hidden">
      {/* Day header */}
      <div
        className="grid border-b border-border-token bg-surface"
        style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}
      >
        <div />
        {days.map((d) => {
          const isToday = localDateKeyFromDate(d) === todayKey;
          return (
            <div
              key={d.toISOString()}
              className="flex items-center justify-center gap-2 py-2 font-mono text-[11px] uppercase tracking-label text-fg-mute"
            >
              <span>{WEEKDAY_LABELS[d.getDay()]}</span>
              <span
                className={clsx(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full font-sans text-[13px] tabular-nums',
                  isToday
                    ? 'bg-primary text-primary-fg font-semibold'
                    : 'text-fg',
                )}
              >
                {d.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* All-day row placeholder — filled in Task 6. */}
      <div
        className="grid border-b border-border-token bg-bg-subtle"
        style={{
          gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))',
          minHeight: '32px',
        }}
      >
        <div className="flex items-center justify-end pr-2 font-mono text-[9px] uppercase tracking-label text-fg-faint">
          all-day
        </div>
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className="border-l border-border-token/60"
          />
        ))}
      </div>

      {/* Scrollable body */}
      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 240px)' }}
      >
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))',
            height: `${HOURS_VISIBLE * HOUR_PX}px`,
          }}
        >
          {/* Time axis column */}
          <div className="relative">
            {Array.from({ length: HOURS_VISIBLE + 1 }, (_, i) => {
              const h = WEEK_GRID_START_HOUR + i;
              return (
                <div
                  key={h}
                  className="absolute right-2 -translate-y-1/2 font-mono text-[10px] text-fg-mute tabular-nums"
                  style={{ top: `${i * HOUR_PX}px` }}
                >
                  {hourLabel(h)}
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          {days.map((d) => {
            const isToday = localDateKeyFromDate(d) === todayKey;
            return (
              <div
                key={d.toISOString()}
                className={clsx(
                  'relative border-l border-border-token/60',
                  isToday && 'bg-primary-soft/30',
                )}
              >
                {Array.from({ length: HOURS_VISIBLE }, (_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-border-token/40"
                    style={{ top: `${i * HOUR_PX}px` }}
                  />
                ))}
                {/* Events and current-time line land here in later tasks. */}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
