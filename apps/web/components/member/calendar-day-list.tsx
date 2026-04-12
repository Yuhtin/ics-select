'use client';

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

interface CalendarDayListProps {
  date: Date;
  sessions: Session[];
  onSessionClick: (session: Session) => void;
}

export function CalendarDayList({ date, sessions, onSessionClick }: CalendarDayListProps) {
  const daySessions = sessions
    .filter((s) => new Date(s.scheduledAt).toDateString() === date.toDateString())
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const dateLabel = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      <h3 className="text-sm font-bold text-foreground capitalize mb-3">{dateLabel}</h3>
      {daySessions.length === 0 ? (
        <p className="text-xs text-foreground-muted">Nenhuma sessao neste dia.</p>
      ) : (
        <div className="space-y-2">
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
      )}
    </div>
  );
}
