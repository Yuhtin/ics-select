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
  engagement: {
    score: number;
    cohortMedian: number;
    breakdown: ScoreBreakdownEntry[];
    scoreByWeek: number[];
  };
  itemsCompleted: {
    total: number;
    planned: number;
    completionPct: number;
    cohortMedian: number;
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
    timeToFirstView: { medianHours: number; cohortMedianHours: number; perWeek: number[] };
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
