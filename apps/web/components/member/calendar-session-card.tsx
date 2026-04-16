'use client';

import { getPlatformKey, PLATFORM_BG_CLASS, PLATFORM_BORDER_CLASS } from './map-2d/platform-colors';

interface CalendarSessionCardProps {
  title: string;
  startHour: string;
  durationMinutes: number;
  format: string;
  url: string | null;
  onClick: () => void;
}

export function CalendarSessionCard({ title, startHour, durationMinutes, format, url, onClick }: CalendarSessionCardProps) {
  const platform = getPlatformKey(url, format);
  const bgClass = PLATFORM_BG_CLASS[platform];
  const borderClass = PLATFORM_BORDER_CLASS[platform];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border-l-[3px] px-2.5 py-1.5 text-xs ${bgClass} ${borderClass} hover:shadow-sm transition-shadow`}
    >
      <p className="font-bold text-foreground truncate">{title}</p>
      <p className="text-foreground-muted">{startHour} · {durationMinutes}min</p>
    </button>
  );
}
