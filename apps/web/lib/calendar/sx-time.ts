import 'temporal-polyfill/global';

/**
 * Schedule-X expects start/end as 'YYYY-MM-DD HH:mm' strings, interpreted
 * in the calendar's configured timezone. Our API returns ISO UTC strings.
 * These helpers bridge the two formats using the Temporal API.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

export function isoToSxLocal(iso: string, timezone: string): string {
  const instant = Temporal.Instant.from(iso);
  const zoned = instant.toZonedDateTimeISO(timezone);
  return `${zoned.year}-${pad(zoned.month)}-${pad(zoned.day)} ${pad(zoned.hour)}:${pad(zoned.minute)}`;
}

export function sxLocalToIso(local: string, timezone: string): string {
  const [date, time] = local.split(' ');
  if (!date || !time) throw new Error(`invalid sx local string: ${local}`);
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const zoned = Temporal.ZonedDateTime.from({
    year: y,
    month: m,
    day: d,
    hour: h,
    minute: min,
    timeZone: timezone,
  });
  return zoned.toInstant().toString();
}

/**
 * Converts the value of an <input type="datetime-local"> ('YYYY-MM-DDTHH:mm')
 * to a Schedule-X local string ('YYYY-MM-DD HH:mm'). Does not touch timezones —
 * the caller is responsible for interpreting the result in the correct tz.
 */
export function datetimeLocalToSx(value: string): string {
  return value.replace('T', ' ');
}

/**
 * Converts a Schedule-X local string ('YYYY-MM-DD HH:mm') to the value format
 * of <input type="datetime-local"> ('YYYY-MM-DDTHH:mm').
 */
export function sxToDatetimeLocal(sx: string): string {
  return sx.replace(' ', 'T');
}
