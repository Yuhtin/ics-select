import { SchedulerService, type SchedulerInput } from './scheduler.service';

const MONDAY = new Date('2026-04-13T00:00:00-03:00');

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
    busyByDay: {
      0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
    },
    items: [],
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

  it('respects busy time by reducing that day budget', () => {
    const result = svc.plan(
      input({
        items: [
          { id: 'i1', estimatedMinutes: 30 },
          { id: 'i2', estimatedMinutes: 30 },
        ],
        busyByDay: {
          0: [{ startMinute: 8 * 60, endMinute: 9 * 60 }], // busy 8-9 Monday
          1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
        },
      }),
    );
    // Monday budget shrinks to 0 (60min - 60min busy), both items move to Tue
    const monday = result.sessions.filter((s) => s.scheduledAt.getUTCDate() === MONDAY.getUTCDate());
    expect(monday.length).toBe(0);
  });
});
