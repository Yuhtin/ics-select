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

  const { data, isLoading, isFetching, isError } = useMeCalendarWeek(weekStart);
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
    <div data-testid="calendar-workspace" className="min-w-0 space-y-5">
      <CalendarHeader
        weekStart={weekStart}
        weekEnd={weekEnd}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        isRefreshing={isFetching && !isLoading}
      />
      {!data ? (
        isError ? <p role="alert" className="py-8 text-sm text-fg-soft">Could not load your calendar.</p> : <CalendarSkeleton />
      ) : (
        <>
          {!data.hasGoogleConnection && <CalendarConnectBanner variant="not_connected" />}
          <div className="grid min-w-0 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div data-testid="calendar-agenda" className="border-b border-border-token pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
              <CalendarSidebar events={data.events} timezone={data.timezone} />
            </div>
            <div className="min-w-0">
              <div data-testid="calendar-grid-scroller" className="overflow-x-auto">
                <div className="min-w-[840px]">
                  <CalendarApp
                    weekStart={weekStart}
                    timezone={data.timezone}
                    events={data.events}
                    onRescheduleClick={setEditing}
                  />
                </div>
              </div>
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
