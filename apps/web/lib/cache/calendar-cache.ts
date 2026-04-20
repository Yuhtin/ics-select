import type { GetWeekResponse } from '../queries/me-calendar';

const VERSION = 'v1';
export const __PREFIX = `ics:calendar:${VERSION}:`;
export const __MAX_WEEKS = 8;

type CachedWeek = { data: GetWeekResponse; updatedAt: number };

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function keyFor(weekStart: Date): string {
  const y = weekStart.getFullYear();
  const m = String(weekStart.getMonth() + 1).padStart(2, '0');
  const d = String(weekStart.getDate()).padStart(2, '0');
  return `${__PREFIX}${y}-${m}-${d}`;
}

export function readCachedWeek(weekStart: Date): CachedWeek | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(keyFor(weekStart));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWeek;
    if (!parsed || typeof parsed.updatedAt !== 'number' || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedWeek(weekStart: Date, data: GetWeekResponse): void {
  if (!isBrowser()) return;
  try {
    const entry: CachedWeek = { data, updatedAt: Date.now() };
    window.localStorage.setItem(keyFor(weekStart), JSON.stringify(entry));
    prune();
  } catch {
    // Cache is an optimisation — silently tolerate quota / serialization errors.
  }
}

function prune(): void {
  if (!isBrowser()) return;
  try {
    const matches: Array<{ key: string; weekStart: string }> = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(__PREFIX)) {
        matches.push({ key, weekStart: key.slice(__PREFIX.length) });
      }
    }
    if (matches.length <= __MAX_WEEKS) return;
    matches.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
    for (const m of matches.slice(__MAX_WEEKS)) {
      window.localStorage.removeItem(m.key);
    }
  } catch {
    // ignore
  }
}
