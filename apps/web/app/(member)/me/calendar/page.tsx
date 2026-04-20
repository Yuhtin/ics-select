'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMeCalendarWeek, useRescheduleEvent } from '../../../../lib/queries/me-calendar';
import { CalendarHeader } from '../../../../components/member/calendar/calendar-header';
import { CalendarSidebar } from '../../../../components/member/calendar/calendar-sidebar';
import { CalendarLegend } from '../../../../components/member/calendar/calendar-legend';
import { CalendarSkeleton } from '../../../../components/member/calendar/calendar-skeleton';
import { CalendarConnectBanner } from '../../../../components/member/calendar/calendar-connect-banner';
import { CalendarGrid } from '../../../../components/member/calendar/calendar-grid';

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

  const { data, isLoading } = useMeCalendarWeek(weekStart);
  const reschedule = useRescheduleEvent(weekStart);

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
      />
      {isLoading || !data ? (
        <CalendarSkeleton />
      ) : (
        <>
          {!data.hasGoogleConnection && <CalendarConnectBanner variant="not_connected" />}
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <CalendarSidebar events={data.events} timezone={data.timezone} />
            <div className="space-y-4">
              <CalendarGrid
                weekStart={weekStart}
                weekEnd={weekEnd}
                timezone={data.timezone}
                events={data.events}
                onReschedule={(input) => reschedule.mutate(input)}
              />
              <CalendarLegend />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
