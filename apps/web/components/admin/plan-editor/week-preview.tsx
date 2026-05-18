'use client';
import { useMemo } from 'react';
import { SectionLabel } from '../../ui/section-label';
import { WeekDayCard, type DayCardItem, type DayCardSlot } from './week-day-card';
import type { WeeklyPlanItem } from '../../../lib/queries/admin-plan-editor';
import type { SchedulingPlacement } from '../../../lib/queries/admin-plan-preview';

export type WeekAvailability = {
  timezone: string;
  capByWeekday: (number | null)[]; // length 7, index 0 = Mon
  slotsByWeekday: DayCardSlot[][]; // length 7, sorted by startMinute
};

export type WeekPreviewProps = {
  weekStart: string;
  availability: WeekAvailability;
  placements: SchedulingPlacement[];
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

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <SectionLabel>Semana · preview</SectionLabel>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-label text-ink-mute">
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
          return (
            <WeekDayCard
              key={label}
              label={label}
              dateLabel={dateLabel}
              capMinutes={props.availability.capByWeekday[idx] ?? null}
              slots={props.availability.slotsByWeekday[idx] ?? []}
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
