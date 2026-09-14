import { describe, it, expect } from 'vitest';
import { bucketBusyByLocalDay } from './busy-by-day';

// Monday 14 Sep 2026, 00:00 UTC — how plans store weekStart.
const WEEK_START = '2026-09-14T00:00:00.000Z';
const TZ = 'America/Sao_Paulo';

describe('bucketBusyByLocalDay', () => {
  it('keeps the previous Sunday night out of Monday', () => {
    // Sunday 13 Sep 21:00–21:30 BRT = Monday 00:00–00:30 UTC.
    const buckets = bucketBusyByLocalDay(
      [{ start: '2026-09-14T00:00:00.000Z', end: '2026-09-14T00:30:00.000Z' }],
      WEEK_START,
      TZ,
    );
    expect(buckets[0]).toEqual([]);
  });

  it('places a late Monday event on Monday even though it is Tuesday in UTC', () => {
    // Monday 21:00–21:30 BRT = Tuesday 00:00–00:30 UTC.
    const buckets = bucketBusyByLocalDay(
      [{ start: '2026-09-15T00:00:00.000Z', end: '2026-09-15T00:30:00.000Z' }],
      WEEK_START,
      TZ,
    );
    expect(buckets[0]).toEqual([{ startMinute: 1260, endMinute: 1290 }]);
    expect(buckets[1]).toEqual([]);
  });

  it('places a late Sunday event on the last day of the week', () => {
    // Sunday 20 Sep 21:00–21:30 BRT = Monday 21 Sep 00:00–00:30 UTC.
    const buckets = bucketBusyByLocalDay(
      [{ start: '2026-09-21T00:00:00.000Z', end: '2026-09-21T00:30:00.000Z' }],
      WEEK_START,
      TZ,
    );
    expect(buckets[6]).toEqual([{ startMinute: 1260, endMinute: 1290 }]);
  });

  it('splits a block that crosses local midnight across both days', () => {
    // Monday 23:00 → Tuesday 01:00 BRT.
    const buckets = bucketBusyByLocalDay(
      [{ start: '2026-09-15T02:00:00.000Z', end: '2026-09-15T04:00:00.000Z' }],
      WEEK_START,
      TZ,
    );
    expect(buckets[0]).toEqual([{ startMinute: 1380, endMinute: 1440 }]);
    expect(buckets[1]).toEqual([{ startMinute: 0, endMinute: 60 }]);
  });

  it('keeps a normal daytime block on its own day', () => {
    // Tuesday 12:00–17:30 BRT.
    const buckets = bucketBusyByLocalDay(
      [{ start: '2026-09-15T15:00:00.000Z', end: '2026-09-15T20:30:00.000Z' }],
      WEEK_START,
      TZ,
    );
    expect(buckets[1]).toEqual([{ startMinute: 720, endMinute: 1050 }]);
  });
});
