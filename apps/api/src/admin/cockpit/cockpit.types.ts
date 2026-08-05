import type { ItemOutcome, UserEventType } from '@ics-select/prisma';
import type { ScoreBreakdownEntry } from './engagement-score.js';
import type { RiskStatus } from './risk-thresholds.js';

export type CockpitRange = 'cycle' | '7d' | 'all';

export type CockpitResponse = {
  member: {
    id: string;
    name: string;
    email: string;
    pictureUrl: string | null;
    track: string | null;
    whatsappPhone: string | null;
  };
  cycle: {
    id: string;
    name: string;
    weekNumber: number;
    weeksTotal: number;
    startsAt: string;
    endsAt: string;
  } | null;
  range: CockpitRange;
  risk: { status: RiskStatus; reasons: string[] };
  /**
   * Null when `range === 'all'`. The score and every cohort median it carries
   * are defined inside a single cycle (cohort rank, days active vs. days
   * elapsed, retros vs. weeks elapsed); there is no meaningful way to sum them
   * across cycles, so the card unmounts instead of showing a fabricated number.
   */
  engagement: {
    score: number;
    cohortMedian: number;
    breakdown: ScoreBreakdownEntry[];
    scoreByWeek: number[];
  } | null;
  itemsCompleted: {
    total: number;
    planned: number;
    completionPct: number;
    cohortMedian: number;
    /**
     * Median number of items planned across the cohort. Used by the
     * cockpit card to show the fairness hint when this member's plan is
     * larger than typical — the engagement score's "Plan completion"
     * criterion already protects them via max(personalRate, done /
     * cohortMedianPlanned), but the card needs the denominator to
     * communicate that to the admin.
     */
    cohortMedianPlanned: number;
    byOutcome: Record<ItemOutcome, number>;
    perWeek: Array<{ weekStart: string; byOutcome: Record<ItemOutcome, number> }>;
    needsAttention: { total: number; stuck: number; doubts: number };
  };
  timeInvested: {
    actualMinutes: number;
    scheduledMinutes: number;
    cohortMedianMinutes: number;
    naoSeiCount: number;
    perWeekMinutes: number[];
  };
  behavior: {
    sessions:        { value: number; cohortMedian: number; perWeek: number[] };
    daysActive:      { value: number; cycleDays: number; cohortMedian: number; perWeek: number[] };
    daysStudying:    { value: number; cycleDays: number; cohortMedian: number; perWeek: number[] };
    retros:          { submitted: number; expected: number };
    carryOver:       { value: number; cohortMedian: number; perWeek: number[] };
    lastSeen:        { occurredAt: string | null; surface: string | null };
  };
  topicEngagement: Array<{
    topicId: string;
    label: string;
    minutes: number;
    pctOfTotal: number;
    itemsDone: number;
    itemsPlanned: number;
    cohortMedianMinutes: number;
  }>;
  classAttendance: {
    present: number;
    total: number;
    cohortPresent: number;
    sessions: Array<{ scheduledAt: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | null }>;
  };
  firstSession: { occurredAt: string; dayOfCycle: number } | null;
  recentActivity: Array<{
    occurredAt: string;
    type: UserEventType;
    meta: unknown;
    label: string;
  }>;
};
