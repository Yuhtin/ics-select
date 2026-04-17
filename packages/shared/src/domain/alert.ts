export const ALERT_TYPES = [
  'STUCK_RECENT',
  'DISAPPEARED',
  'STUCK_REPEATEDLY',
  'FINISHED_EARLY',
  'SKIPPED_RETROS',
  'PLAN_PENDING',
  'CALENDAR_BROKEN',
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_SEVERITY: Record<AlertType, 'urgent' | 'attention' | 'scheduled'> = {
  STUCK_RECENT: 'urgent',
  DISAPPEARED: 'urgent',
  CALENDAR_BROKEN: 'urgent',
  STUCK_REPEATEDLY: 'attention',
  FINISHED_EARLY: 'attention',
  SKIPPED_RETROS: 'attention',
  PLAN_PENDING: 'scheduled',
};
