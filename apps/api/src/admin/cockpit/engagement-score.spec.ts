import { computeEngagementScore, type EngagementInput } from './engagement-score.js';

const baseInput: EngagementInput = {
  cohortRankFromBottom: 6,
  cohortSize: 12,
  daysActive: 12,
  daysElapsed: 14,
  itemsDone: 8,
  itemsPlanned: 16,
  retrosSubmitted: 2,
  weeksElapsed: 2,
  ttfvMedianHours: 2,
  daysSinceLastSession: 1,
};

describe('computeEngagementScore', () => {
  it('returns 100 for a perfect member', () => {
    const score = computeEngagementScore({
      cohortRankFromBottom: 12,
      cohortSize: 12,
      daysActive: 14,
      daysElapsed: 14,
      itemsDone: 16,
      itemsPlanned: 16,
      retrosSubmitted: 2,
      weeksElapsed: 2,
      ttfvMedianHours: 0,
      daysSinceLastSession: 0,
    });
    expect(score.score).toBe(100);
  });

  it('returns 0 for a fully disengaged member', () => {
    const score = computeEngagementScore({
      cohortRankFromBottom: 0,
      cohortSize: 12,
      daysActive: 0,
      daysElapsed: 14,
      itemsDone: 0,
      itemsPlanned: 16,
      retrosSubmitted: 0,
      weeksElapsed: 2,
      ttfvMedianHours: 48,
      daysSinceLastSession: 30,
    });
    expect(score.score).toBe(0);
  });

  it('handles weeksElapsed=0 without dividing by zero', () => {
    const score = computeEngagementScore({
      ...baseInput,
      weeksElapsed: 0,
      retrosSubmitted: 0,
    });
    expect(Number.isFinite(score.score)).toBe(true);
  });

  it('handles cohortSize=1 (only one member, no rank)', () => {
    const score = computeEngagementScore({
      ...baseInput,
      cohortSize: 1,
      cohortRankFromBottom: 1,
    });
    expect(score.score).toBeGreaterThan(0);
  });

  it('returns rounded integer', () => {
    const { score } = computeEngagementScore(baseInput);
    expect(Number.isInteger(score)).toBe(true);
  });

  it('reports each component breakdown', () => {
    const { breakdown } = computeEngagementScore(baseInput);
    const labels = breakdown.map((b) => b.label);
    expect(labels).toEqual([
      'Cohort rank',
      'Days active',
      'Plan completion',
      'Retros submitted',
      'Time to first view',
      'Recency',
    ]);
  });

  it('TTFv bonus is 10 at 0h, 0 at 24h, linear in between', () => {
    const at0 = computeEngagementScore({ ...baseInput, ttfvMedianHours: 0 });
    const at12 = computeEngagementScore({ ...baseInput, ttfvMedianHours: 12 });
    const at24 = computeEngagementScore({ ...baseInput, ttfvMedianHours: 24 });
    const c0 = at0.breakdown.find((b) => b.label === 'Time to first view')!.value;
    const c12 = at12.breakdown.find((b) => b.label === 'Time to first view')!.value;
    const c24 = at24.breakdown.find((b) => b.label === 'Time to first view')!.value;
    expect(c0).toBe(10);
    expect(c12).toBe(5);
    expect(c24).toBe(0);
  });

  it('Recency: 10 if ≤3d, 5 if ≤7d, 0 if >14d', () => {
    const r1 = computeEngagementScore({ ...baseInput, daysSinceLastSession: 2 });
    const r2 = computeEngagementScore({ ...baseInput, daysSinceLastSession: 5 });
    const r3 = computeEngagementScore({ ...baseInput, daysSinceLastSession: 20 });
    const get = (s: typeof r1) => s.breakdown.find((b) => b.label === 'Recency')!.value;
    expect(get(r1)).toBe(10);
    expect(get(r2)).toBe(5);
    expect(get(r3)).toBe(0);
  });
});
