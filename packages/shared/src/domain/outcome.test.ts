import { describe, it, expect } from 'vitest';
import {
  ITEM_OUTCOMES,
  POSITIVE_OUTCOMES,
  isPositiveOutcome,
  isSkipped,
  summarizeOutcomes,
} from './outcome';

describe('ItemOutcome', () => {
  it('includes SKIPPED in the enum', () => {
    expect(ITEM_OUTCOMES).toContain('SKIPPED');
  });

  it('treats SKIPPED as positive', () => {
    expect(POSITIVE_OUTCOMES.has('SKIPPED')).toBe(true);
    expect(isPositiveOutcome('SKIPPED')).toBe(true);
  });

  it('isSkipped is true only for SKIPPED', () => {
    expect(isSkipped('SKIPPED')).toBe(true);
    expect(isSkipped('DONE_EASY')).toBe(false);
    expect(isSkipped('PENDING')).toBe(false);
  });

  it('summarizeOutcomes counts SKIPPED', () => {
    const counts = summarizeOutcomes([{ outcome: 'SKIPPED' }, { outcome: 'DONE_EASY' }]);
    expect(counts.SKIPPED).toBe(1);
    expect(counts.DONE_EASY).toBe(1);
  });
});
