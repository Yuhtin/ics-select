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

  it('skips weekends — a Mon-Fri streak survives an unstudied Sat/Sun', () => {
    // asOf = Monday 2026-05-18 BRT (21:00 BRT = May 19 00:00 UTC, choose 14:00 BRT for clarity)
    const monAsOf = new Date('2026-05-18T17:00:00Z'); // 14:00 BRT, May 18 (Mon)
    const items = [
      { completedAt: new Date('2026-05-18T15:00:00Z') }, // Mon May 18 BRT
      // Sat May 16 and Sun May 17 NOT studied — must NOT break streak.
      { completedAt: new Date('2026-05-15T15:00:00Z') }, // Fri May 15 BRT
      { completedAt: new Date('2026-05-14T15:00:00Z') }, // Thu
      { completedAt: new Date('2026-05-13T15:00:00Z') }, // Wed
      { completedAt: new Date('2026-05-12T15:00:00Z') }, // Tue
      { completedAt: new Date('2026-05-11T15:00:00Z') }, // Mon
    ];
    expect(computeStreakDays(items, monAsOf)).toBe(6);
  });

  it('weekend completions still count when present', () => {
    const monAsOf = new Date('2026-05-18T17:00:00Z');
    const items = [
      { completedAt: new Date('2026-05-18T15:00:00Z') }, // Mon
      { completedAt: new Date('2026-05-17T15:00:00Z') }, // Sun
      { completedAt: new Date('2026-05-16T15:00:00Z') }, // Sat
      { completedAt: new Date('2026-05-15T15:00:00Z') }, // Fri
      // Thu missing — should break here.
    ];
    expect(computeStreakDays(items, monAsOf)).toBe(4);
  });

  it('respects BRT timezone when classifying weekends', () => {
    // Sun May 17 23:00 BRT = Mon May 18 02:00 UTC. The streak rule cares
    // about the BRT calendar day, so this completion belongs to Sun (the
    // weekend), NOT Mon. With asOf = Mon and no Mon completion, streak = 0
    // because we walk into Mon (a weekday) with no completion → break.
    // BUT Sun was studied — irrelevant since the WEEKDAY break happens first.
    const monAsOf = new Date('2026-05-18T17:00:00Z');
    const items = [
      { completedAt: new Date('2026-05-18T02:00:00Z') }, // 23:00 BRT Sun May 17
    ];
    expect(computeStreakDays(items, monAsOf)).toBe(0);
  });
});
