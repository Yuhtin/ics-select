import { classifyRisk, type RiskInput } from './risk-thresholds.js';

const ok: RiskInput = {
  daysSinceLastSession: 1,
  completionRate: 0.8,
  cohortRankPct: 0.7,
};

describe('classifyRisk', () => {
  it('ON_TRACK when no criteria match', () => {
    expect(classifyRisk(ok).status).toBe('ON_TRACK');
  });

  it('AT_RISK when 2 of 3 AT_RISK criteria match', () => {
    expect(
      classifyRisk({ daysSinceLastSession: 8, completionRate: 0.1, cohortRankPct: 0.7 }).status,
    ).toBe('AT_RISK');
  });

  it('AT_RISK takes precedence over WATCH', () => {
    const r = classifyRisk({
      daysSinceLastSession: 8,
      completionRate: 0.2,
      cohortRankPct: 0.2,
    });
    expect(r.status).toBe('AT_RISK');
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('WATCH when 2 of 3 WATCH criteria match (but not AT_RISK)', () => {
    expect(
      classifyRisk({
        daysSinceLastSession: 4,
        completionRate: 0.4,
        cohortRankPct: 0.7,
      }).status,
    ).toBe('WATCH');
  });

  it('reasons are human-readable strings', () => {
    const r = classifyRisk({
      daysSinceLastSession: 9,
      completionRate: 0.1,
      cohortRankPct: 0.1,
    });
    expect(r.reasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/days no session/i),
        expect.stringMatching(/items completed/i),
        expect.stringMatching(/bottom/i),
      ]),
    );
  });

  it('only one criterion matching = ON_TRACK', () => {
    expect(
      classifyRisk({ daysSinceLastSession: 9, completionRate: 0.8, cohortRankPct: 0.7 }).status,
    ).toBe('ON_TRACK');
  });
});
