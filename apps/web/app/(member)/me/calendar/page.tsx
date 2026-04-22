'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMeCalendarWeek, useRescheduleEvent } from '../../../../lib/queries/me-calendar';
import type { CalendarEvent } from '../../../../lib/queries/me-calendar';
import { CalendarHeader } from '../../../../components/member/calendar/calendar-header';
import { CalendarSidebar } from '../../../../components/member/calendar/calendar-sidebar';
import { CalendarLegend } from '../../../../components/member/calendar/calendar-legend';
import { CalendarSkeleton } from '../../../../components/member/calendar/calendar-skeleton';
import { CalendarGridSkeleton } from '../../../../components/member/calendar/calendar-grid-skeleton';
import { CalendarConnectBanner } from '../../../../components/member/calendar/calendar-connect-banner';
import { RescheduleModal } from '../../../../components/member/calendar/reschedule-modal';

const CalendarApp = dynamic(
  () =>
    import('../../../../components/member/calendar/week-grid').then(
      (m) => m.WeekGrid,
    ),
  { ssr: false, loading: () => <CalendarGridSkeleton /> },
);

function startOfSundayWeek(d: Date): Date {
  const copy = new Date(d);
  const dayIdx = copy.getDay(); // 0 = Sunday
  copy.setDate(copy.getDate() - dayIdx);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function MeCalendarPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfSundayWeek(new Date()));
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const { data, isLoading, isFetching } = useMeCalendarWeek(weekStart);
  const reschedule = useRescheduleEvent(weekStart);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);

  const handlePrev = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);
  const handleNext = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);
  const handleToday = useCallback(() => setWeekStart(startOfSundayWeek(new Date())), []);

  return (
    <div className="space-y-4">
      <CalendarHeader
        weekStart={weekStart}
        weekEnd={weekEnd}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        isRefreshing={isFetching && !isLoading}
      />
      {!data ? (
        <CalendarSkeleton />
      ) : (
        <>
          {!data.hasGoogleConnection && <CalendarConnectBanner variant="not_connected" />}
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <CalendarSidebar events={data.events} timezone={data.timezone} />
            <div className="space-y-4">
              <CalendarApp
                weekStart={weekStart}
                timezone={data.timezone}
                events={data.events}
                onRescheduleClick={setEditing}
              />
              <CalendarLegend />
            </div>
          </div>
        </>
      )}
      <RescheduleModal
        event={editing}
        timezone={data?.timezone ?? 'America/Sao_Paulo'}
        onClose={() => setEditing(null)}
        onSubmit={(input) => reschedule.mutate(input)}
      />
    </div>
  );
}
