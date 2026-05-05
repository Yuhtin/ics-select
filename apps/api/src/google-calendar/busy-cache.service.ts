import { Injectable, Logger } from '@nestjs/common';
import { GoogleCalendarService, type FreeBusyBlock } from './google-calendar.service.js';

type CacheEntry = {
  value: FreeBusyBlock[];
  fetchedAt: number;
  /** Wall-clock ms after which the entry is dropped entirely. */
  expiresAt: number;
  /** In-flight refresh promise, if one is currently running. */
  refreshing: Promise<FreeBusyBlock[]> | null;
};

/**
 * How old (ms) an entry can be before a foreground read kicks off a
 * background refresh. Foreground always returns the cached value
 * synchronously — staleness is bounded by this number plus whatever the
 * background fetch takes.
 *
 * 60s is a sweet spot: most admin sessions don't need sub-minute fresh
 * data, and one-minute staleness can't cause a real correctness issue
 * (the scheduler runs against live getFreeBusy on publish anyway).
 */
const STALE_AFTER_MS = 60_000;

/**
 * Per-process in-memory cache for `getFreeBusy` keyed by `(userId, weekStart)`.
 *
 * Entries hold the **full week** of busy blocks so a single cached payload
 * serves every plan-context read for the same week regardless of "now".
 * The downstream consumer (`buildEffectiveIntervals`) clips to `now` itself.
 *
 * Behavior:
 *   - **Cold** (no entry) — caller awaits a fresh fetch.
 *   - **Hit & fresh** (≤ STALE_AFTER_MS old) — returns cached value, no refresh.
 *   - **Hit & stale** — returns cached value immediately, kicks off a
 *     background refresh that updates the entry for the next reader. No
 *     concurrent refreshes — the in-flight promise is reused.
 *   - **Expired** (past `expiresAt`) — treated as cold.
 *
 * Eviction:
 *   - Entries auto-expire `weekEnd + 1 day` after the week ends. Past weeks
 *     are never re-fetched anyway and stale data can't mislead — the badge
 *     hides for past weeks.
 *
 * Invalidation hooks (`invalidate` / `invalidateAllForUser`) are called by
 * code paths that mutate the member's calendar (outcome marking moves an
 * event; publish/reschedule create or delete events). After invalidation
 * the next read is cold and re-fetches.
 *
 * In-process only — single-container deploy. If we ever go multi-instance
 * the cache layer should move to Redis with the same surface.
 */
@Injectable()
export class BusyCacheService {
  private readonly logger = new Logger(BusyCacheService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly calendar: GoogleCalendarService) {}

  /**
   * Get busy blocks for a given (userId, week). Returns cached value when
   * present, schedules a background refresh when stale.
   *
   * `lookFrom` only narrows the API call when we're actually fetching; the
   * cached payload always represents the full week so it stays reusable
   * regardless of what "now" the caller has.
   */
  async getWeekBusy(
    userId: string,
    weekStart: Date,
    weekEnd: Date,
  ): Promise<FreeBusyBlock[]> {
    const key = this.keyFor(userId, weekStart);
    const now = Date.now();
    const entry = this.cache.get(key);

    if (entry && entry.expiresAt > now) {
      const age = now - entry.fetchedAt;
      if (age >= STALE_AFTER_MS && !entry.refreshing) {
        this.scheduleBackgroundRefresh(key, userId, weekStart, weekEnd);
      }
      return entry.value;
    }

    // Cold or expired — wait for fresh.
    return this.fetchAndStore(key, userId, weekStart, weekEnd);
  }

  /**
   * Drop the cached entry for a specific week. Call after any action that
   * mutates the member's calendar in that week (outcome reconcile, publish,
   * reschedule).
   */
  invalidate(userId: string, weekStart: Date): void {
    const key = this.keyFor(userId, weekStart);
    if (this.cache.delete(key)) {
      this.logger.log(`busy-cache invalidate · ${key}`);
    }
  }

  /**
   * Drop every cached entry for a user — used when we don't know exactly
   * which week's calendar changed (e.g. a bulk reschedule).
   */
  invalidateAllForUser(userId: string): void {
    const prefix = `${userId}:`;
    let n = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        n += 1;
      }
    }
    if (n > 0) this.logger.log(`busy-cache invalidate-all · user=${userId} · n=${n}`);
  }

  /** Test hook — drop everything. Don't call from production code. */
  clearAll(): void {
    this.cache.clear();
  }

  private keyFor(userId: string, weekStart: Date): string {
    return `${userId}:${weekStart.toISOString()}`;
  }

  private async fetchAndStore(
    key: string,
    userId: string,
    weekStart: Date,
    weekEnd: Date,
  ): Promise<FreeBusyBlock[]> {
    const value = await this.calendar.getFreeBusy(userId, weekStart, weekEnd);
    const now = Date.now();
    this.cache.set(key, {
      value,
      fetchedAt: now,
      // Keep around for one extra day past week end; past weeks need no refresh.
      expiresAt: weekEnd.getTime() + 24 * 60 * 60 * 1000,
      refreshing: null,
    });
    return value;
  }

  private scheduleBackgroundRefresh(
    key: string,
    userId: string,
    weekStart: Date,
    weekEnd: Date,
  ): void {
    const entry = this.cache.get(key);
    if (!entry || entry.refreshing) return;
    const promise = (async () => {
      try {
        const value = await this.calendar.getFreeBusy(userId, weekStart, weekEnd);
        const now = Date.now();
        const current = this.cache.get(key);
        // Only update if the entry is still ours (not invalidated mid-flight).
        if (current === entry) {
          this.cache.set(key, {
            value,
            fetchedAt: now,
            expiresAt: weekEnd.getTime() + 24 * 60 * 60 * 1000,
            refreshing: null,
          });
        }
        return value;
      } catch (err) {
        this.logger.warn(`busy-cache bg refresh failed · ${key} · ${String(err)}`);
        // Clear the in-flight marker on the existing entry so a future
        // read can try again.
        const current = this.cache.get(key);
        if (current) current.refreshing = null;
        return entry.value;
      }
    })();
    entry.refreshing = promise;
    // Surface unhandled rejections — promise is fire-and-forget.
    promise.catch(() => {});
  }
}
