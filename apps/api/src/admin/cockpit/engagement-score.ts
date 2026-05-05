export const COHORT_RANK_LABEL = 'Cohort rank';

export type EngagementInput = {
  cohortRankFromBottom: number; // 0 = worst, cohortSize = best
  cohortSize: number;
  daysActive: number;
  daysElapsed: number;
  itemsDone: number;
  itemsPlanned: number;
  retrosSubmitted: number;
  weeksElapsed: number;
  // Null = no events recorded yet. Recency points = 0 (neutral, no penalty).
  daysSinceLastSession: number | null;
  // Cohort median of itemsPlanned. When provided, completion points use
  // max(personalRate, itemsDone/cohortMedianPlanned) so a member who got a
  // bigger plan than the cohort isn't double-penalized for completing fewer %.
  cohortMedianItemsPlanned?: number | null;
};

export type ScoreBreakdownEntry = {
  label: string;
  value: number;
  weight: number;
  status: 'ok' | 'warn' | 'bad';
};

export type EngagementScore = {
  score: number;
  breakdown: ScoreBreakdownEntry[];
};

export function computeEngagementScore(input: EngagementInput): EngagementScore {
  const cohortRankPct =
    input.cohortSize > 0 ? input.cohortRankFromBottom / input.cohortSize : 1;
  const cohortPts = Math.max(0, Math.min(1, cohortRankPct)) * 25;

  const activePct =
    input.daysElapsed > 0
      ? Math.min(1, input.daysActive / input.daysElapsed)
      : 0;
  const activePts = activePct * 20;

  const personalRate =
    input.itemsPlanned > 0 ? input.itemsDone / input.itemsPlanned : 0;
  const cohortNormalizedRate =
    input.cohortMedianItemsPlanned && input.cohortMedianItemsPlanned > 0
      ? Math.min(1, input.itemsDone / input.cohortMedianItemsPlanned)
      : 0;
  // Take the more flattering of: (a) personal completion rate, (b) what the
  // member would have done relative to the typical cohort plan size. A member
  // assigned 14 items in a cohort that averages 6 isn't punished for finishing
  // "only" 6 — that's already at parity with everyone else.
  const completionPts = Math.max(0, Math.min(1, Math.max(personalRate, cohortNormalizedRate))) * 20;

  const retroRate =
    input.weeksElapsed > 0
      ? Math.min(1, input.retrosSubmitted / input.weeksElapsed)
      : 0;
  const retroPts = retroRate * 20;

  let recencyPts = 0;
  if (input.daysSinceLastSession === null) recencyPts = 0;
  else if (input.daysSinceLastSession <= 3) recencyPts = 15;
  else if (input.daysSinceLastSession <= 7) recencyPts = 8;
  else if (input.daysSinceLastSession <= 14) recencyPts = 3;
  else recencyPts = 0;

  const total = cohortPts + activePts + completionPts + retroPts + recencyPts;

  const breakdown: ScoreBreakdownEntry[] = [
    { label: COHORT_RANK_LABEL,     value: round(cohortPts),     weight: 25, status: statusFor(cohortPts, 25) },
    { label: 'Days active',         value: round(activePts),     weight: 20, status: statusFor(activePts, 20) },
    { label: 'Plan completion',     value: round(completionPts), weight: 20, status: statusFor(completionPts, 20) },
    { label: 'Retros submitted',    value: round(retroPts),      weight: 20, status: statusFor(retroPts, 20) },
    { label: 'Recency',             value: round(recencyPts),    weight: 15, status: statusFor(recencyPts, 15) },
  ];

  return { score: Math.round(total), breakdown };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function statusFor(value: number, max: number): 'ok' | 'warn' | 'bad' {
  const pct = max === 0 ? 0 : value / max;
  if (pct >= 0.66) return 'ok';
  if (pct >= 0.33) return 'warn';
  return 'bad';
}
