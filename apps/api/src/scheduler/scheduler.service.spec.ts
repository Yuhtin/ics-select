import { SchedulerService, type SchedulerInput } from './scheduler.service';

const MONDAY = new Date('2026-04-13T00:00:00-03:00');
// Pin `now` to just before the week starts so all 7 days are future.
const BEFORE_WEEK = new Date('2026-04-12T12:00:00-03:00');

function input(overrides: Partial<SchedulerInput> = {}): SchedulerInput {
  return {
    weekStart: MONDAY,
    availability: {
      mondayMinutes: 60,
      tuesdayMinutes: 60,
      wednesdayMinutes: 60,
      thursdayMinutes: 60,
      fridayMinutes: 60,
      saturdayMinutes: 0,
      sundayMinutes: 0,
      preferredSessionMinutes: 60,
      timezone: 'America/Sao_Paulo',
    },
    busyBlocks: [],
    items: [],
    now: BEFORE_WEEK,
    ...overrides,
  };
}

describe('SchedulerService.plan', () => {
  const svc = new SchedulerService();

  it('places a single short item on Monday', () => {
    const result = svc.plan(
      input({ items: [{ id: 'i1', estimatedMinutes: 30 }] }),
    );
    expect(result.overflow).toEqual([]);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]?.itemId).toBe('i1');
    expect(result.sessions[0]?.durationMinutes).toBe(30);
    // Monday 08:00 local ~= 11:00 UTC
    expect(result.sessions[0]?.scheduledAt.getUTCHours()).toBe(11);
  });

  it('splits a 90-minute item into two 45-minute sessions when pref is 45', () => {
    const result = svc.plan(
      input({
        items: [{ id: 'i1', estimatedMinutes: 90 }],
        availability: { ...input().availability, preferredSessionMinutes: 45 },
      }),
    );
    expect(result.overflow).toEqual([]);
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0]?.durationMinutes).toBe(45);
    expect(result.sessions[1]?.durationMinutes).toBe(45);
  });

  it('leaves a residue chunk for an item that is not a multiple of pref', () => {
    const result = svc.plan(
      input({
        items: [{ id: 'i1', estimatedMinutes: 100 }],
        availability: { ...input().availability, preferredSessionMinutes: 45 },
      }),
    );
    expect(result.sessions).toHaveLength(3);
    expect(result.sessions[0]?.durationMinutes).toBe(45);
    expect(result.sessions[1]?.durationMinutes).toBe(45);
    expect(result.sessions[2]?.durationMinutes).toBe(10);
  });

  it('moves to the next day when daily budget is exceeded', () => {
    const result = svc.plan(
      input({
        items: [
          { id: 'i1', estimatedMinutes: 60 },
          { id: 'i2', estimatedMinutes: 60 },
        ],
      }),
    );
    expect(result.sessions).toHaveLength(2);
    // First on Monday, second on Tuesday (budget 60 min fills on Monday)
    const d1 = result.sessions[0]?.scheduledAt.getUTCDate();
    const d2 = result.sessions[1]?.scheduledAt.getUTCDate();
    expect(d2).toBe((d1 ?? 0) + 1);
  });

  it('reports overflow when the plan exceeds the weekly budget', () => {
    const result = svc.plan(
      input({
        items: [
          { id: 'i1', estimatedMinutes: 60 },
          { id: 'i2', estimatedMinutes: 60 },
          { id: 'i3', estimatedMinutes: 60 },
          { id: 'i4', estimatedMinutes: 60 },
          { id: 'i5', estimatedMinutes: 60 },
          { id: 'i6', estimatedMinutes: 60 },
        ],
      }),
    );
    // 5 week days × 60 min = 300 min; 6 × 60 = 360 min total; 60 min overflows
    expect(result.sessions.length).toBe(5);
    expect(result.overflow.length).toBeGreaterThan(0);
    expect(result.overflow[0]?.itemId).toBe('i6');
  });

  it('skips days that have already ended (now-aware)', () => {
    // Week starts Monday 2026-04-13 (BRT). Set now to Wednesday 2026-04-15 10:00 BRT.
    // Monday and Tuesday should be fully skipped.
    const wednesday10 = new Date('2026-04-15T10:00:00-03:00');
    const result = svc.plan(
      input({
        items: [
          { id: 'i1', estimatedMinutes: 60 },
          { id: 'i2', estimatedMinutes: 60 },
          { id: 'i3', estimatedMinutes: 60 },
        ],
        now: wednesday10,
      }),
    );
    expect(result.overflow).toEqual([]);
    expect(result.sessions).toHaveLength(3);
    const utcDates = result.sessions.map((s) => s.scheduledAt.getUTCDate());
    // All sessions should land on Wed (15) or later — never on Mon (13) / Tue (14).
    for (const d of utcDates) expect(d).toBeGreaterThanOrEqual(15);
  });

  it('on today, bumps first session past current local time', () => {
    // Monday 2026-04-13 11:00 BRT — DAY_START is 08:00 but it's already 11:00,
    // so the first Monday session must start ≥ 11:00 BRT = 14:00 UTC.
    const monday11 = new Date('2026-04-13T11:00:00-03:00');
    const result = svc.plan(
      input({
        items: [{ id: 'i1', estimatedMinutes: 60 }],
        now: monday11,
      }),
    );
    expect(result.sessions).toHaveLength(1);
    const first = result.sessions[0]!;
    // 11:00 BRT = 14:00 UTC, rounded up to nearest 15 min.
    expect(first.scheduledAt.getUTCHours()).toBeGreaterThanOrEqual(14);
  });

  it('skips busy intervals instead of overlapping them', () => {
    // Busy 08:00-10:00 BRT on Monday (UTC 11:00-13:00). A 30-min item with
    // preferredSessionMinutes=30 and mondayMinutes=60 must start AFTER 10:00
    // BRT (13:00 UTC), not on top of the meeting.
    const busyStart = new Date('2026-04-13T08:00:00-03:00'); // Mon 11:00 UTC
    const busyEnd = new Date('2026-04-13T10:00:00-03:00'); // Mon 13:00 UTC
    const result = svc.plan(
      input({
        items: [{ id: 'i1', estimatedMinutes: 30 }],
        availability: { ...input().availability, preferredSessionMinutes: 30 },
        busyBlocks: [{ start: busyStart, end: busyEnd }],
      }),
    );
    expect(result.overflow).toEqual([]);
    expect(result.sessions).toHaveLength(1);
    const session = result.sessions[0]!;
    // Monday, after 10:00 BRT = 13:00 UTC. Date is still Apr 13.
    expect(session.scheduledAt.getUTCDate()).toBe(MONDAY.getUTCDate());
    expect(session.scheduledAt.getTime()).toBeGreaterThanOrEqual(busyEnd.getTime());
  });

  it('declared budget caps study minutes per day regardless of free time', () => {
    // Monday declared = 30min, Tuesday declared = 30min. No busy. Two 30-min
    // chunks: one lands Monday, the second goes to Tuesday because Monday's
    // 30-min daily cap is already spent.
    const result = svc.plan(
      input({
        items: [
          { id: 'i1', estimatedMinutes: 30 },
          { id: 'i2', estimatedMinutes: 30 },
        ],
        availability: {
          ...input().availability,
          mondayMinutes: 30,
          tuesdayMinutes: 30,
          preferredSessionMinutes: 30,
        },
      }),
    );
    expect(result.sessions).toHaveLength(2);
    const mondaySessions = result.sessions.filter(
      (s) => s.scheduledAt.getUTCDate() === MONDAY.getUTCDate(),
    );
    expect(mondaySessions).toHaveLength(1);
  });

  it('splits chunks across free intervals when busy sits in the middle', () => {
    // Busy 10:00-14:00 BRT Monday splits the day into two free windows.
    // mondayMinutes=120 with a 30-min pref gives four chunks; the first two
    // land before 10:00, the remainder after 14:00.
    const busyStart = new Date('2026-04-13T10:00:00-03:00');
    const busyEnd = new Date('2026-04-13T14:00:00-03:00');
    const result = svc.plan(
      input({
        items: [{ id: 'i1', estimatedMinutes: 120 }],
        availability: {
          ...input().availability,
          mondayMinutes: 120,
          preferredSessionMinutes: 30,
        },
        busyBlocks: [{ start: busyStart, end: busyEnd }],
      }),
    );
    expect(result.overflow).toEqual([]);
    const mondaySessions = result.sessions.filter(
      (s) => s.scheduledAt.getUTCDate() === MONDAY.getUTCDate(),
    );
    // At least one session before the meeting, at least one after.
    const before = mondaySessions.filter((s) => s.scheduledAt < busyStart);
    const after = mondaySessions.filter((s) => s.scheduledAt >= busyEnd);
    expect(before.length).toBeGreaterThan(0);
    expect(after.length).toBeGreaterThan(0);
    // None overlap the busy window.
    for (const s of mondaySessions) {
      const sessionEnd = new Date(
        s.scheduledAt.getTime() + s.durationMinutes * 60_000,
      );
      const overlaps =
        s.scheduledAt < busyEnd && sessionEnd > busyStart;
      expect(overlaps).toBe(false);
    }
  });
});
