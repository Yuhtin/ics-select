'use client';
import { useMemo } from 'react';
import { SectionLabel } from '../../ui/section-label';
import {
  WeekDayCard,
  type DayCardItem,
  type DayCardSlot,
} from './week-day-card';
import type { WeeklyPlanItem } from '../../../lib/queries/admin-plan-editor';
import type {
  PreviewBusyBlock,
  SchedulingPlacement,
} from '../../../lib/queries/admin-plan-preview';
import { bucketBusyByLocalDay, localToUtcMs } from '../../../lib/scheduling/busy-by-day';

export type WeekAvailability = {
  timezone: string;
  capByWeekday: (number | null)[]; // length 7, index 0 = Mon
  slotsByWeekday: DayCardSlot[][]; // length 7, sorted by startMinute
};

export type WeekPreviewProps = {
  weekStart: string;
  availability: WeekAvailability;
  placements: SchedulingPlacement[];
  /**
   * Google Calendar busy blocks the scheduler saw. Rendered per day so the
   * admin sees why a "free" slot is actually unschedulable.
   */
  busyBlocks?: PreviewBusyBlock[];
  items: WeeklyPlanItem[];
  overflowItemIds: Set<string>;
  isUpdating?: boolean;
  isStale?: boolean;
  onItemClick?: (libraryItemId: string) => void;
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayIdxOf(iso: string, weekStartIso: string): number {
  const date = new Date(iso);
  const start = new Date(weekStartIso);
  const diff = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, Math.min(6, diff));
}

export function WeekPreview(props: WeekPreviewProps) {
  const itemsByLibId = useMemo(() => {
    const map = new Map<string, WeeklyPlanItem>();
    for (const i of props.items) map.set(i.libraryItemId, i);
    return map;
  }, [props.items]);

  const cards = useMemo(() => {
    const buckets: DayCardItem[][] = [[], [], [], [], [], [], []];
    const dayHasOverflow = [false, false, false, false, false, false, false];

    for (const p of props.placements) {
      const idx = dayIdxOf(p.scheduledAt, props.weekStart);
      const item = itemsByLibId.get(p.itemId);
      if (!item) continue;
      buckets[idx]!.push({
        itemId: item.id,
        libraryItemId: item.libraryItemId,
        title: item.libraryItem.title,
        format: item.libraryItem.format,
        url: item.libraryItem.url ?? null,
        outcome: item.outcome,
        scheduledAt: p.scheduledAt,
        durationMinutes: p.durationMinutes,
      });
      if (props.overflowItemIds.has(p.itemId)) dayHasOverflow[idx] = true;
    }
    for (const bucket of buckets) {
      bucket.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    }
    return { buckets, dayHasOverflow };
  }, [props.placements, props.weekStart, itemsByLibId, props.overflowItemIds]);

  const totalMinutes = props.placements.reduce((sum, p) => sum + p.durationMinutes, 0);

  // Render in member-local minutes since the day card slots are local minutes.
  const busyByWeekday = useMemo(
    () =>
      bucketBusyByLocalDay(props.busyBlocks ?? [], props.weekStart, props.availability.timezone),
    [props.busyBlocks, props.weekStart, props.availability.timezone],
  );

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <SectionLabel>Semana · preview</SectionLabel>
        <div className="flex items-center gap-3 font-sans text-xs text-fg-mute">
          <span>
            Total: {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
          </span>
          {props.isUpdating && <span className="italic">atualizando…</span>}
          {props.isStale && !props.isUpdating && (
            <span className="italic">preview defasado</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {DAY_LABELS.map((label, idx) => {
          const dayDate = new Date(props.weekStart);
          dayDate.setUTCDate(dayDate.getUTCDate() + idx);
          const dateLabel = `${dayDate.getUTCDate()} ${dayDate.toLocaleString('en', {
            month: 'short',
            timeZone: 'UTC',
          })}`;
          // Mark slots whose end is already past in the member's timezone, so
          // the card distinguishes "free but past" from "free and bookable".
          const nowMs = Date.now();
          const tz = props.availability.timezone;
          const rawSlots = props.availability.slotsByWeekday[idx] ?? [];
          const slotsWithPast = rawSlots.map((s) => {
            const endUtcMs = localToUtcMs(
              dayDate.getUTCFullYear(),
              dayDate.getUTCMonth() + 1,
              dayDate.getUTCDate(),
              Math.floor(s.endMinute / 60),
              s.endMinute % 60,
              tz,
            );
            return { ...s, isPast: endUtcMs <= nowMs };
          });
          return (
            <WeekDayCard
              key={label}
              label={label}
              dateLabel={dateLabel}
              capMinutes={props.availability.capByWeekday[idx] ?? null}
              slots={slotsWithPast}
              busyBlocks={busyByWeekday[idx]}
              items={cards.buckets[idx]!}
              contributesOverflow={cards.dayHasOverflow[idx]}
              onItemClick={props.onItemClick}
            />
          );
        })}
      </div>
    </section>
  );
}
