'use client';

import { useMemo } from 'react';
import { CalendarSessionCard } from './calendar-session-card';

interface Session {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  libraryItem: {
    title: string;
    format: string;
    url: string | null;
  };
}

interface CalendarWeeklyProps {
  weekStart: Date;
  sessions: Session[];
  onSessionClick: (session: Session) => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 7);
const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

export function CalendarWeekly({ weekStart, sessions, onSessionClick }: CalendarWeeklyProps) {
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const today = new Date();

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
        <div />
        {weekDays.map((day, i) => {
          const isToday = day.toDateString() === today.toDateString();
          return (
            <div key={`h-${i}`} className={`text-center py-3 border-l border-border ${isToday ? 'bg-brand/5' : ''}`}>
              <span className="text-xs text-foreground-muted">{DAY_LABELS[i]}</span>
              <span className={`block text-lg font-bold ${isToday ? 'text-brand' : 'text-foreground'}`}>
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-[60px_repeat(7,1fr)] max-h-[600px] overflow-y-auto">
        {HOURS.map((hour) => (
          <div key={hour} className="contents">
            <div className="h-16 flex items-start justify-end pr-2 pt-1 text-[10px] text-foreground-subtle border-t border-border/50">
              {hour}:00
            </div>
            {weekDays.map((day, dayIdx) => {
              const daySessions = sessions.filter((s) => {
                const d = new Date(s.scheduledAt);
                return d.toDateString() === day.toDateString() && d.getHours() === hour;
              });
              return (
                <div key={`c-${hour}-${dayIdx}`} className="h-16 border-l border-t border-border/50 p-0.5">
                  {daySessions.map((s) => (
                    <CalendarSessionCard
                      key={s.id}
                      title={s.libraryItem.title}
                      startHour={new Date(s.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      durationMinutes={s.durationMinutes}
                      format={s.libraryItem.format}
                      url={s.libraryItem.url}
                      onClick={() => onSessionClick(s)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
