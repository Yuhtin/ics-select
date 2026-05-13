import { computeStreakDays } from './streak';

describe('computeStreakDays', () => {
  const asOf = new Date('2026-05-13T23:59:59Z'); // 20:59 BRT, May 13

  it('returns 0 when no completions', () => {
    expect(computeStreakDays([], asOf)).toBe(0);
  });

  it('counts consecutive BRT calendar days ending at asOf', () => {
    const items = [
      { completedAt: new Date('2026-05-13T21:00:00Z') }, // May 13 BRT
      { completedAt: new Date('2026-05-12T23:00:00Z') }, // May 12 BRT (20:00)
      { completedAt: new Date('2026-05-11T15:00:00Z') }, // May 11 BRT
    ];
    expect(computeStreakDays(items, asOf)).toBe(3);
  });

  it('breaks on a missing day', () => {
    const items = [
      { completedAt: new Date('2026-05-13T21:00:00Z') }, // May 13
      { completedAt: new Date('2026-05-11T15:00:00Z') }, // May 11 (gap on May 12)
    ];
    expect(computeStreakDays(items, asOf)).toBe(1);
  });

  it('handles BRT-day-edge boundary correctly', () => {
    // 23:00 UTC on May 11 = 20:00 BRT May 11 — still May 11 BRT, not May 12.
    const items = [
      { completedAt: new Date('2026-05-13T21:00:00Z') },
      { completedAt: new Date('2026-05-12T03:00:00Z') }, // 00:00 BRT May 12
      { completedAt: new Date('2026-05-11T23:00:00Z') }, // 20:00 BRT May 11
    ];
    expect(computeStreakDays(items, asOf)).toBe(3);
  });

  it('ignores completions after asOf', () => {
    const items = [
      { completedAt: new Date('2026-05-14T10:00:00Z') }, // after asOf
      { completedAt: new Date('2026-05-13T21:00:00Z') },
    ];
    expect(computeStreakDays(items, asOf)).toBe(1);
  });
});
