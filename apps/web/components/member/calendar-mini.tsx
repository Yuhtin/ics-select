'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';

interface CalendarMiniProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function CalendarMini({ selectedDate, onSelectDate }: CalendarMiniProps) {
  const [viewMonth, setViewMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const days = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date | null }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d) });
    return cells;
  }, [viewMonth]);

  const monthLabel = viewMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const today = new Date();

  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} className="p-1 hover:bg-surface-subtle rounded-lg">
          <ChevronLeft className="h-4 w-4 text-foreground-muted" />
        </button>
        <span className="text-sm font-bold text-foreground capitalize">{monthLabel}</span>
        <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} className="p-1 hover:bg-surface-subtle rounded-lg">
          <ChevronRight className="h-4 w-4 text-foreground-muted" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <span key={`header-${i}`} className="text-[10px] font-medium text-foreground-subtle">{d}</span>
        ))}
        {days.map((cell, i) => {
          if (!cell.date) return <span key={`empty-${i}`} />;
          const isToday = cell.date.toDateString() === today.toDateString();
          const isSelected = cell.date.toDateString() === selectedDate.toDateString();
          const d = cell.date;
          return (
            <button
              key={`day-${d.getDate()}`}
              type="button"
              onClick={() => onSelectDate(d)}
              className={`h-7 w-7 rounded-full text-xs font-medium transition-colors ${
                isSelected ? 'bg-brand text-white' :
                isToday ? 'bg-brand/10 text-brand font-bold' :
                'text-foreground-muted hover:bg-surface-subtle'
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
