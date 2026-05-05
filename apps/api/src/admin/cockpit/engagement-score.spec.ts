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
      'Recency',
    ]);
  });

  it('Recency: 10 if ≤3d, 5 if ≤7d, 2 if ≤14d, 0 if >14d', () => {
    const r1 = computeEngagementScore({ ...baseInput, daysSinceLastSession: 2 });
    const r2 = computeEngagementScore({ ...baseInput, daysSinceLastSession: 5 });
    const r3 = computeEngagementScore({ ...baseInput, daysSinceLastSession: 10 });
    const r4 = computeEngagementScore({ ...baseInput, daysSinceLastSession: 20 });
    const get = (s: typeof r1) => s.breakdown.find((b) => b.label === 'Recency')!.value;
    expect(get(r1)).toBe(10);
    expect(get(r2)).toBe(5);
    expect(get(r3)).toBe(2);
    expect(get(r4)).toBe(0);
  });

  it('Retros: max 20 pts at 100% rate', () => {
    const perfect = computeEngagementScore({ ...baseInput, retrosSubmitted: 2, weeksElapsed: 2 });
    const retro = perfect.breakdown.find((b) => b.label === 'Retros submitted')!;
    expect(retro.value).toBe(20);
    expect(retro.weight).toBe(20);
  });
});
