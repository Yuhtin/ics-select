/** "HH:mm" in the viewer's local timezone. */
export function formatTimeLocal(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** "Wed, Apr 16" — English abbreviated, in the viewer's local timezone. */
export function formatDateLocal(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
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

/** "5h ago" / "3d ago" / "2w ago" / "just now". Returns '' for invalid input. */
export function formatRelativeFromIso(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = now.getTime() - then;
  if (diffMs < 0 || diffMs < 60 * 1000) return 'just now';
  const diffMin = Math.floor(diffMs / (60 * 1000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  const diffW = Math.floor(diffD / 7);
  return `${diffW}w ago`;
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) throw new Error(`bad time: ${hhmm}`);
  return (h! * 60) + m!;
}

export function thirtyMinuteGrid(): string[] {
  const out: string[] = [];
  for (let m = 0; m <= 1440; m += 30) out.push(minutesToHHMM(m));
  return out;
}
