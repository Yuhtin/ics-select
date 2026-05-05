import { computeRemainingWeekCapacity } from './capacity';
import type { AvailabilitySlotInput, BusyBlock } from './scheduler.types';

const MONDAY = new Date('2026-04-13T00:00:00-03:00'); // Monday 03:00 UTC
const BEFORE_WEEK = new Date('2026-04-12T12:00:00-03:00');
const TZ = 'America/Sao_Paulo';

// Helper: a 9-22h window (9 hours = 540 min) on the given dayOfWeek.
const window = (dayOfWeek: number): AvailabilitySlotInput => ({
  dayOfWeek,
  startMinute: 9 * 60,
  endMinute: 22 * 60,
});

describe('computeRemainingWeekCapacity', () => {
  it('returns full week when nothing is booked and "now" is before the week starts', () => {
    const slots = [window(0), window(1), window(2), window(3), window(4)]; // Mon..Fri
    const caps = [60, 60, 60, 60, 60, 0, 0]; // Mon..Sun
    const out = computeRemainingWeekCapacity({
      weekStart: MONDAY,
      slots,
      caps,
      busyBlocks: [],
      timezone: TZ,
      now: BEFORE_WEEK,
    });
    expect(out.totalMinutes).toBe(60 * 5);
    expect(out.daysRemaining).toBe(5);
    expect(out.perDay[0]).toMatchObject({ remainingMinutes: 60, isPast: false });
    expect(out.perDay[5]).toMatchObject({ remainingMinutes: 0 }); // Sat, no slot
  });

  it('caps remaining at the day cap when the window is wider than the cap', () => {
    // 13h window vs 60-min cap → remaining = 60.
    const out = computeRemainingWeekCapacity({
      weekStart: MONDAY,
      slots: [window(0)],
      caps: [60, null, null, null, null, null, null],
      busyBlocks: [],
      timezone: TZ,
      now: BEFORE_WEEK,
    });
    expect(out.perDay[0]!.freeMinutesInWindows).toBe(13 * 60);
    expect(out.perDay[0]!.remainingMinutes).toBe(60);
  });

  it('uses full window when cap is null (no cap)', () => {
    const out = computeRemainingWeekCapacity({
      weekStart: MONDAY,
      slots: [window(0)],
      caps: [null, null, null, null, null, null, null],
      busyBlocks: [],
      timezone: TZ,
      now: BEFORE_WEEK,
    });
    expect(out.perDay[0]!.remainingMinutes).toBe(13 * 60);
  });

  it('subtracts busy from the window before applying cap', () => {
    // Mon 12-14h busy (120 min), 9-22h window (780 min), cap 600.
    // freeInWindow = 780 - 120 = 660. remaining = min(660, 600) = 600.
    const busy: BusyBlock[] = [{
      start: new Date('2026-04-13T12:00:00-03:00'),
      end: new Date('2026-04-13T14:00:00-03:00'),
    }];
    const out = computeRemainingWeekCapacity({
      weekStart: MONDAY,
      slots: [window(0)],
      caps: [600, null, null, null, null, null, null],
      busyBlocks: busy,
      timezone: TZ,
      now: BEFORE_WEEK,
    });
    expect(out.perDay[0]!.freeMinutesInWindows).toBe(660);
    expect(out.perDay[0]!.remainingMinutes).toBe(600);
  });

  it('a heavily-booked day with small cap drops to 0 (busy >= window − cap)', () => {
    // 13h window, cap 60, busy 12.5h → freeInWindow = 30, remaining = min(30, 60) = 30.
    const busy: BusyBlock[] = [{
      start: new Date('2026-04-13T09:00:00-03:00'),
      end: new Date('2026-04-13T21:30:00-03:00'),
    }];
    const out = computeRemainingWeekCapacity({
      weekStart: MONDAY,
      slots: [window(0)],
      caps: [60, null, null, null, null, null, null],
      busyBlocks: busy,
      timezone: TZ,
      now: BEFORE_WEEK,
    });
    expect(out.perDay[0]!.freeMinutesInWindows).toBe(30);
    expect(out.perDay[0]!.remainingMinutes).toBe(30);
  });

  it('marks past days as isPast and contributes 0', () => {
    const slots = [window(0), window(1), window(2)]; // Mon, Tue, Wed
    const caps = [60, 60, 60, 0, 0, 0, 0];
    // "now" is mid-week Wednesday morning → Mon and Tue are fully past.
    const wedMorning = new Date('2026-04-15T09:00:00-03:00');
    const out = computeRemainingWeekCapacity({
      weekStart: MONDAY,
      slots,
      caps,
      busyBlocks: [],
      timezone: TZ,
      now: wedMorning,
    });
    expect(out.perDay[0]!.isPast).toBe(true);
    expect(out.perDay[0]!.remainingMinutes).toBe(0);
    expect(out.perDay[1]!.isPast).toBe(true);
    expect(out.perDay[2]!.isPast).toBe(false);
    // Wed window from 9am: started at the cursor → buildEffectiveIntervals
    // clips today's window to [now, end], leaving 13h. Cap of 60 still wins.
    expect(out.perDay[2]!.remainingMinutes).toBe(60);
    expect(out.totalMinutes).toBe(60); // only Wed
    expect(out.daysRemaining).toBe(1);
  });

  it('respects 0 cap (member declared "no studying that day")', () => {
    const out = computeRemainingWeekCapacity({
      weekStart: MONDAY,
      slots: [window(0)],
      caps: [0, null, null, null, null, null, null],
      busyBlocks: [],
      timezone: TZ,
      now: BEFORE_WEEK,
    });
    expect(out.perDay[0]!.remainingMinutes).toBe(0);
    expect(out.totalMinutes).toBe(0);
  });
});
