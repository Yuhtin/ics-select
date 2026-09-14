import { describe, it, expect } from 'vitest';
import { computeDayFreeMinutes } from './day-free';

// 08:00–22:00 in local minutes, the backfilled default window.
const WIDE_SLOT = { startMinute: 480, endMinute: 1320 };

describe('computeDayFreeMinutes', () => {
  it('a 30m cap stays free when busy time leaves plenty of room in a wide slot', () => {
    // Real Tuesday from member cmoop4nwp002uh77ubbuzkcjd: 465m busy inside a
    // 840m slot. The old formula did 30 − 465 and clamped to 0.
    const free = computeDayFreeMinutes({
      capMinutes: 30,
      futureSlots: [WIDE_SLOT],
      busyBlocks: [
        { startMinute: 600, endMinute: 615 },
        { startMinute: 720, endMinute: 1050 },
        { startMinute: 1200, endMinute: 1320 },
      ],
      scheduledMinutes: 0,
      itemCount: 0,
    });
    expect(free).toBe(30);
  });

  it('cap room is cap minus scheduled content, matching the scheduler day-load check', () => {
    const free = computeDayFreeMinutes({
      capMinutes: 30,
      futureSlots: [WIDE_SLOT],
      busyBlocks: [{ startMinute: 720, endMinute: 840 }],
      scheduledMinutes: 15,
      itemCount: 1,
    });
    expect(free).toBe(15);
  });

  it('is limited by the free window when busy eats most of a narrow slot', () => {
    const free = computeDayFreeMinutes({
      capMinutes: 120,
      futureSlots: [{ startMinute: 1140, endMinute: 1320 }],
      busyBlocks: [{ startMinute: 1140, endMinute: 1290 }],
      scheduledMinutes: 0,
      itemCount: 0,
    });
    expect(free).toBe(30);
  });

  it('does not double-count overlapping busy blocks', () => {
    const free = computeDayFreeMinutes({
      capMinutes: 240,
      futureSlots: [{ startMinute: 1080, endMinute: 1320 }],
      busyBlocks: [
        { startMinute: 1080, endMinute: 1200 },
        { startMinute: 1140, endMinute: 1170 },
      ],
      scheduledMinutes: 0,
      itemCount: 0,
    });
    expect(free).toBe(120);
  });

  it('charges the inter-session buffer against the window, not the cap', () => {
    const free = computeDayFreeMinutes({
      capMinutes: 120,
      futureSlots: [{ startMinute: 1140, endMinute: 1200 }],
      busyBlocks: [],
      scheduledMinutes: 30,
      itemCount: 1,
    });
    expect(free).toBe(20);
  });

  it('ignores busy time outside the study slots', () => {
    const free = computeDayFreeMinutes({
      capMinutes: 60,
      futureSlots: [{ startMinute: 1140, endMinute: 1320 }],
      busyBlocks: [{ startMinute: 540, endMinute: 600 }],
      scheduledMinutes: 0,
      itemCount: 0,
    });
    expect(free).toBe(60);
  });
});
