import { describe, it, expect } from 'vitest';
import { allocatedMinutes, sumAllocatedMinutes, sumConsumedMinutes } from './scheduling';

describe('allocatedMinutes', () => {
  it('rounds non-video up to 15-min slots with 3-min tolerance', () => {
    expect(allocatedMinutes(2)).toBe(15);
    expect(allocatedMinutes(18)).toBe(15);
    expect(allocatedMinutes(19)).toBe(30);
    expect(allocatedMinutes(33)).toBe(30);
    expect(allocatedMinutes(34)).toBe(45);
  });

  it('doubles VIDEO before slotting', () => {
    expect(allocatedMinutes(13, 'VIDEO')).toBe(30);
    expect(allocatedMinutes(8, 'VIDEO')).toBe(15);
    expect(allocatedMinutes(20, 'VIDEO')).toBe(45);
    expect(allocatedMinutes(30, 'VIDEO')).toBe(60);
  });
});

describe('sumAllocatedMinutes', () => {
  it('sums non-skipped items', () => {
    const total = sumAllocatedMinutes([
      { estimatedMinutes: 30, format: 'ARTICLE' },
      { estimatedMinutes: 13, format: 'VIDEO' },
      { estimatedMinutes: 30, format: 'ARTICLE', outcome: 'SKIPPED' },
    ]);
    expect(total).toBe(30 + 30); // 30 article + 30 video, skipped excluded
  });
});

describe('sumConsumedMinutes', () => {
  it('counts actualMinutes when present for DONE_EASY/DONE_HARD/DOUBTS', () => {
    const total = sumConsumedMinutes([
      { estimatedMinutes: 30, actualMinutes: 12, outcome: 'DONE_EASY' },
      { estimatedMinutes: 30, actualMinutes: 25, outcome: 'DONE_HARD' },
      { estimatedMinutes: 30, actualMinutes: 8, outcome: 'DOUBTS' },
    ]);
    expect(total).toBe(12 + 25 + 8);
  });

  it('falls back to allocatedMinutes when actualMinutes is null/missing', () => {
    const total = sumConsumedMinutes([
      { estimatedMinutes: 30, format: 'ARTICLE', outcome: 'DONE_EASY' },
      { estimatedMinutes: 13, format: 'VIDEO', actualMinutes: null, outcome: 'DONE_HARD' },
    ]);
    // 30-min article → allocated 30 + 13-min video → allocated 30
    expect(total).toBe(60);
  });

  it('treats actualMinutes <= 0 as missing (falls back)', () => {
    const total = sumConsumedMinutes([
      { estimatedMinutes: 30, format: 'ARTICLE', actualMinutes: 0, outcome: 'DONE_EASY' },
    ]);
    expect(total).toBe(30); // not 0
  });

  it('excludes SKIPPED — skipping means no time was spent', () => {
    const total = sumConsumedMinutes([
      { estimatedMinutes: 30, actualMinutes: 0, outcome: 'SKIPPED' },
      { estimatedMinutes: 30, actualMinutes: 30, outcome: 'DONE_EASY' },
    ]);
    expect(total).toBe(30);
  });

  it('excludes PENDING and STUCK', () => {
    const total = sumConsumedMinutes([
      { estimatedMinutes: 30, actualMinutes: 20, outcome: 'PENDING' },
      { estimatedMinutes: 30, actualMinutes: 20, outcome: 'STUCK' },
      { estimatedMinutes: 30, actualMinutes: 20, outcome: 'DONE_EASY' },
    ]);
    expect(total).toBe(20);
  });

  it('excludes items with no outcome', () => {
    const total = sumConsumedMinutes([{ estimatedMinutes: 30, actualMinutes: 20 }]);
    expect(total).toBe(0);
  });
});
