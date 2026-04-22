// Pure timezone helpers for the week grid. Uses Intl.DateTimeFormat so we
// don't pull Temporal into this component.

type Parts = {
  year: number;
  month: number; // 1..12
  day: number;
  hour: number; // 0..23
  minute: number;
  weekday: number; // 0 = Sunday .. 6 = Saturday
};

function partsOf(iso: string, timezone: string): Parts {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
    map.weekday ?? 'Sun',
  );
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    weekday: weekdayIndex,
  };
}

/** Minute-of-day (0..1439) for an ISO instant in the given IANA tz. */
export function getMinuteOfLocalDay(iso: string, timezone: string): number {
  const p = partsOf(iso, timezone);
  return p.hour * 60 + p.minute;
}

/** 0 = Sunday .. 6 = Saturday in the given IANA tz. */
export function getLocalWeekdayIndex(iso: string, timezone: string): number {
  return partsOf(iso, timezone).weekday;
}

/** YYYY-MM-DD calendar date in tz. Used to bucket events by column. */
export function getLocalDateKey(iso: string, timezone: string): string {
  const p = partsOf(iso, timezone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Calendar-date key for a Date object already in its own local sense.
 * weekStart from /me/calendar/page.tsx is built via new Date() with local
 * setters, so use local getters here — not UTC, not tz-aware. */
export function localDateKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
