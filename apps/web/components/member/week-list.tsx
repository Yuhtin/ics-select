'use client';

import type { HomeResponse } from '../../lib/queries/me-home';
import { DayList } from './day-list';

interface WeekListProps {
  today: HomeResponse['today'];
  days: HomeResponse['days'];
}

export function WeekList({ today, days }: WeekListProps) {
  return (
    <div className="space-y-10">
      <DayList label="Today" items={today} />
      {days.map((day) => (
        <DayList key={day.date} label={day.label} items={day.items} />
      ))}
    </div>
  );
}
