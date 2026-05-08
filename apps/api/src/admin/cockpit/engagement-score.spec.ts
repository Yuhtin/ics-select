import { computeEngagementScore, type EngagementInput } from './engagement-score.js';

const baseInput: EngagementInput = {
  cohortRankFromBottom: 6,
  cohortSize: 12,
  daysActive: 4,
  daysElapsed: 8,
  itemsDone: 8,
  itemsPlanned: 16,
  retrosSubmitted: 2,
  weeksElapsed: 2,
  daysSinceLastSession: 1,
  classesAttended: 0,
  classesHeld: 0,
};

describe('computeEngagementScore', () => {
  it('returns 100 for a perfect member', () => {
    // daysActive=4, daysElapsed=8 → 4/(8×0.5)=1 → full 15 active pts
    const score = computeEngagementScore({
      cohortRankFromBottom: 12,
      cohortSize: 12,
      daysActive: 4,
      daysElapsed: 8,
      itemsDone: 16,
      itemsPlanned: 16,
      retrosSubmitted: 2,
      weeksElapsed: 2,
      daysSinceLastSession: 0,
      classesAttended: 4,
      classesHeld: 4,
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
      classesAttended: 0,
      classesHeld: 0,
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
      'Class attendance',
      'Recency',
    ]);
  });

  it('Recency: 12 if ≤1d, 8 if ≤3d, 4 if ≤7d, 0 if >7d', () => {
    const r0 = computeEngagementScore({ ...baseInput, daysSinceLastSession: 0 });
    const r1 = computeEngagementScore({ ...baseInput, daysSinceLastSession: 1 });
    const r2 = computeEngagementScore({ ...baseInput, daysSinceLastSession: 2 });
    const r3 = computeEngagementScore({ ...baseInput, daysSinceLastSession: 3 });
    const r5 = computeEngagementScore({ ...baseInput, daysSinceLastSession: 5 });
    const r7 = computeEngagementScore({ ...baseInput, daysSinceLastSession: 7 });
    const r10 = computeEngagementScore({ ...baseInput, daysSinceLastSession: 10 });
    const r20 = computeEngagementScore({ ...baseInput, daysSinceLastSession: 20 });
    const get = (s: typeof r0) => s.breakdown.find((b) => b.label === 'Recency')!.value;
    expect(get(r0)).toBe(12);
    expect(get(r1)).toBe(12);
    expect(get(r2)).toBe(8);
    expect(get(r3)).toBe(8);
    expect(get(r5)).toBe(4);
    expect(get(r7)).toBe(4);
    expect(get(r10)).toBe(0);
    expect(get(r20)).toBe(0);
  });

  it('Days active: ceiling is 50% of daysElapsed (4 active / 8 elapsed = 100%)', () => {
    const atCeiling = computeEngagementScore({ ...baseInput, daysActive: 4, daysElapsed: 8 });
    const active = atCeiling.breakdown.find((b) => b.label === 'Days active')!;
    expect(active.value).toBe(15);

    const half = computeEngagementScore({ ...baseInput, daysActive: 2, daysElapsed: 8 });
    const halfActive = half.breakdown.find((b) => b.label === 'Days active')!;
    expect(halfActive.value).toBe(7.5);
  });

  it('Plan completion: max 27 pts at 100% rate', () => {
    const perfect = computeEngagementScore({
      ...baseInput,
      itemsDone: 16,
      itemsPlanned: 16,
    });
    const completion = perfect.breakdown.find((b) => b.label === 'Plan completion')!;
    expect(completion.value).toBe(27);
    expect(completion.weight).toBe(27);
  });

  it('Retros: max 21 pts at 100% rate', () => {
    const perfect = computeEngagementScore({ ...baseInput, retrosSubmitted: 2, weeksElapsed: 2 });
    const retro = perfect.breakdown.find((b) => b.label === 'Retros submitted')!;
    expect(retro.value).toBe(21);
    expect(retro.weight).toBe(21);
  });

  it('Class attendance: 0 if no classes held; full 5 pts at 100% PRESENT rate', () => {
    const noClasses = computeEngagementScore({ ...baseInput, classesAttended: 0, classesHeld: 0 });
    const att0 = noClasses.breakdown.find((b) => b.label === 'Class attendance')!;
    expect(att0.value).toBe(0);
    expect(att0.weight).toBe(5);

    const fullAtt = computeEngagementScore({ ...baseInput, classesAttended: 4, classesHeld: 4 });
    const att100 = fullAtt.breakdown.find((b) => b.label === 'Class attendance')!;
    expect(att100.value).toBe(5);
    expect(att100.weight).toBe(5);

    const halfAtt = computeEngagementScore({ ...baseInput, classesAttended: 2, classesHeld: 4 });
    const att50 = halfAtt.breakdown.find((b) => b.label === 'Class attendance')!;
    expect(att50.value).toBe(2.5);
    expect(att50.weight).toBe(5);
  });
});
