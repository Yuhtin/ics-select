/** "19:00" in UTC. */
export function formatTimeUtc(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** "Wed, Apr 16" — English abbreviated. */
export function formatDateShort(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/** "45 min" / "1 h 30 min". */
export function formatMinutes(m: number | null | undefined): string {
  if (m === null || m === undefined) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} h` : `${h} h ${rem} min`;
}

/** "in 23 min" / "2 min ago". */
export function formatRelative(minutes: number): string {
  const abs = Math.abs(minutes);
  const future = minutes >= 0;
  if (abs < 60) return future ? `in ${abs} min` : `${abs} min ago`;
  const h = Math.round(abs / 60);
  return future ? `in ${h} h` : `${h} h ago`;
}
