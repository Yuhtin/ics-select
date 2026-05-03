export const RISK_THRESHOLDS = {
  AT_RISK: {
    daysSinceLastSession: 7,
    completionRate: 0.25,
    cohortRankBottomPct: 0.25,
  },
  WATCH: {
    daysSinceLastSession: 3,
    completionRate: 0.5,
    cohortRankBottomPct: 0.5,
  },
} as const;

export type RiskStatus = 'ON_TRACK' | 'WATCH' | 'AT_RISK';

export type RiskInput = {
  // Null = no events recorded yet. Session criterion is skipped (treated as
  // not-met) so a fresh-deploy member doesn't get flagged AT_RISK on day 1.
  daysSinceLastSession: number | null;
  completionRate: number;        // 0..1
  cohortRankPct: number;         // 0..1, where 0 = bottom of cohort, 1 = top
};

export type RiskVerdict = {
  status: RiskStatus;
  reasons: string[];
};

export function classifyRisk(input: RiskInput): RiskVerdict {
  const atRiskHits = collectHits(input, RISK_THRESHOLDS.AT_RISK);
  if (atRiskHits.length >= 2) {
    return { status: 'AT_RISK', reasons: atRiskHits.map(formatReason) };
  }
  const watchHits = collectHits(input, RISK_THRESHOLDS.WATCH);
  if (watchHits.length >= 2) {
    return { status: 'WATCH', reasons: watchHits.map(formatReason) };
  }
  return { status: 'ON_TRACK', reasons: [] };
}

type HitKind = 'session' | 'completion' | 'cohort';
type Hit = { kind: HitKind; value: number; threshold: number };

type ThresholdSet = {
  readonly daysSinceLastSession: number;
  readonly completionRate: number;
  readonly cohortRankBottomPct: number;
};

function collectHits(
  input: RiskInput,
  t: ThresholdSet,
): Hit[] {
  const hits: Hit[] = [];
  if (input.daysSinceLastSession !== null && input.daysSinceLastSession >= t.daysSinceLastSession) {
    hits.push({ kind: 'session', value: input.daysSinceLastSession, threshold: t.daysSinceLastSession });
  }
  if (input.completionRate <= t.completionRate) {
    hits.push({ kind: 'completion', value: input.completionRate, threshold: t.completionRate });
  }
  if (input.cohortRankPct <= t.cohortRankBottomPct) {
    hits.push({ kind: 'cohort', value: input.cohortRankPct, threshold: t.cohortRankBottomPct });
  }
  return hits;
}

function formatReason(hit: Hit): string {
  switch (hit.kind) {
    case 'session':
      return `${hit.value} days no session`;
    case 'completion':
      return `${Math.round(hit.value * 100)}% items completed`;
    case 'cohort':
      return `cohort bottom ${Math.round(hit.threshold * 100)}%`;
  }
}
