import { BusyCacheService } from './busy-cache.service';
import type { GoogleCalendarService, FreeBusyBlock } from './google-calendar.service';

const WEEK_START = new Date('2026-04-13T00:00:00Z');
const WEEK_END = new Date('2026-04-20T00:00:00Z');
const USER = 'user-a';

function makeCalendar(seq: FreeBusyBlock[][]) {
  let i = 0;
  const fn = jest.fn(async () => {
    const v = seq[i] ?? seq[seq.length - 1] ?? [];
    i += 1;
    return v;
  });
  return { getFreeBusy: fn } as unknown as GoogleCalendarService;
}

// Drain microtasks — flushes chained Promise resolutions inside the bg
// refresh. Fake timers don't fake microtasks, so awaiting a few rounds
// of Promise.resolve is enough.
const tick = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

describe('BusyCacheService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-15T10:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('cold read fetches and caches', async () => {
    const blocks: FreeBusyBlock[] = [
      { start: new Date('2026-04-15T12:00:00Z'), end: new Date('2026-04-15T13:00:00Z') },
    ];
    const calendar = makeCalendar([blocks]);
    const cache = new BusyCacheService(calendar);

    const a = await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    expect(a).toEqual(blocks);
    expect(calendar.getFreeBusy).toHaveBeenCalledTimes(1);

    // Second read inside freshness window — no fetch.
    const b = await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    expect(b).toEqual(blocks);
    expect(calendar.getFreeBusy).toHaveBeenCalledTimes(1);
  });

  it('stale read returns cached value AND triggers a background refresh', async () => {
    const first: FreeBusyBlock[] = [
      { start: new Date('2026-04-15T12:00:00Z'), end: new Date('2026-04-15T13:00:00Z') },
    ];
    const second: FreeBusyBlock[] = [
      { start: new Date('2026-04-15T14:00:00Z'), end: new Date('2026-04-15T15:00:00Z') },
    ];
    const calendar = makeCalendar([first, second]);
    const cache = new BusyCacheService(calendar);

    const a = await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    expect(a).toEqual(first);

    // Advance past the staleness threshold.
    jest.setSystemTime(new Date('2026-04-15T10:02:00Z')); // +2 min

    // Stale read: returns the cached (first) value immediately.
    const b = await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    expect(b).toEqual(first);

    // Background refresh has been kicked off — let it settle.
    await tick();

    // Now the next read sees the refreshed value.
    const c = await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    expect(c).toEqual(second);
    expect(calendar.getFreeBusy).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent stale refreshes — only one bg fetch in flight', async () => {
    const first: FreeBusyBlock[] = [];
    const second: FreeBusyBlock[] = [
      { start: new Date('2026-04-15T14:00:00Z'), end: new Date('2026-04-15T15:00:00Z') },
    ];
    const calendar = makeCalendar([first, second]);
    const cache = new BusyCacheService(calendar);

    await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    jest.setSystemTime(new Date('2026-04-15T10:02:00Z'));

    // Three reads in a row while stale — each returns cached, only one bg refresh fires.
    await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    await tick();

    expect(calendar.getFreeBusy).toHaveBeenCalledTimes(2); // 1 cold + 1 bg
  });

  it('invalidate forces the next read to refetch', async () => {
    const first: FreeBusyBlock[] = [];
    const second: FreeBusyBlock[] = [
      { start: new Date('2026-04-15T16:00:00Z'), end: new Date('2026-04-15T17:00:00Z') },
    ];
    const calendar = makeCalendar([first, second]);
    const cache = new BusyCacheService(calendar);

    await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    cache.invalidate(USER, WEEK_START);
    const a = await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    expect(a).toEqual(second);
    expect(calendar.getFreeBusy).toHaveBeenCalledTimes(2);
  });

  it('invalidateAllForUser clears every week for that user', async () => {
    const calendar = makeCalendar([[], []]);
    const cache = new BusyCacheService(calendar);
    const otherWeekStart = new Date('2026-04-20T00:00:00Z');
    const otherWeekEnd = new Date('2026-04-27T00:00:00Z');

    await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    await cache.getWeekBusy(USER, otherWeekStart, otherWeekEnd);
    expect(calendar.getFreeBusy).toHaveBeenCalledTimes(2);

    cache.invalidateAllForUser(USER);

    await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    await cache.getWeekBusy(USER, otherWeekStart, otherWeekEnd);
    expect(calendar.getFreeBusy).toHaveBeenCalledTimes(4);
  });

  it('expired entry (past weekEnd + 1 day) refetches on read', async () => {
    const calendar = makeCalendar([[], [{ start: new Date(), end: new Date() }]]);
    const cache = new BusyCacheService(calendar);

    await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    // Jump past weekEnd + 1 day.
    jest.setSystemTime(new Date('2026-04-22T00:00:00Z'));
    await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    expect(calendar.getFreeBusy).toHaveBeenCalledTimes(2);
  });

  it('background refresh failure leaves the stale entry usable for the next read', async () => {
    const first: FreeBusyBlock[] = [
      { start: new Date('2026-04-15T12:00:00Z'), end: new Date('2026-04-15T13:00:00Z') },
    ];
    let calls = 0;
    const calendar = {
      getFreeBusy: jest.fn(async () => {
        calls += 1;
        if (calls === 1) return first;
        if (calls === 2) throw new Error('transient');
        return first;
      }),
    } as unknown as GoogleCalendarService;
    const cache = new BusyCacheService(calendar);

    await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    jest.setSystemTime(new Date('2026-04-15T10:02:00Z'));
    const b = await cache.getWeekBusy(USER, WEEK_START, WEEK_END); // returns first, bg fires
    expect(b).toEqual(first);
    await tick();

    // Next read still has the old cached value — bg failed but didn't poison it.
    const c = await cache.getWeekBusy(USER, WEEK_START, WEEK_END);
    expect(c).toEqual(first);
    // And it tries another bg refresh because the entry is still stale.
    await tick();
    expect(calls).toBe(3);
  });
});
