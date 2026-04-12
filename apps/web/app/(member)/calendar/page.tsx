'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api/client';
import { CalendarMini } from '../../../components/member/calendar-mini';
import { CalendarWeekly } from '../../../components/member/calendar-weekly';
import { CalendarDayList } from '../../../components/member/calendar-day-list';

type PlanItem = {
  id: string;
  libraryItem: { title: string; format: string; url: string | null };
  sessions: Array<{ id: string; scheduledAt: string; durationMinutes: number }>;
};

type Plan = {
  id: string;
  weekStart: string;
  weekEnd: string;
  items: PlanItem[];
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);

  const { data, isLoading } = useQuery({
    queryKey: ['me-week'],
    queryFn: () => apiFetch<Plan[]>('/me/week'),
  });

  const sessions = useMemo(() => {
    if (!data) return [];
    return data.flatMap((plan) =>
      plan.items.flatMap((item) =>
        item.sessions.map((s) => ({
          ...s,
          libraryItem: item.libraryItem,
        })),
      ),
    );
  }, [data]);

  const shiftWeek = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta * 7);
    setSelectedDate(d);
  };

  if (isLoading) {
    return <p className="text-sm text-foreground-muted p-8">Carregando calendario...</p>;
  }

  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);

  return (
    <div className="px-4 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-foreground">Calendario</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shiftWeek(-1)} className="p-2 hover:bg-surface-subtle rounded-lg">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-foreground">
            {weekStart.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} —{' '}
            {weekEnd.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
          </span>
          <button type="button" onClick={() => shiftWeek(1)} className="p-2 hover:bg-surface-subtle rounded-lg">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="hidden lg:grid grid-cols-[250px_1fr] gap-6">
        <div className="space-y-4">
          <CalendarMini selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <CalendarDayList date={selectedDate} sessions={sessions} onSessionClick={() => {}} />
        </div>
        <CalendarWeekly weekStart={weekStart} sessions={sessions} onSessionClick={() => {}} />
      </div>

      <div className="lg:hidden space-y-4">
        <CalendarMini selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        <CalendarDayList date={selectedDate} sessions={sessions} onSessionClick={() => {}} />
      </div>
    </div>
  );
}
