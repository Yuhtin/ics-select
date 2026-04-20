export declare const ALERT_TYPES: readonly ["STUCK_RECENT", "DISAPPEARED", "STUCK_REPEATEDLY", "FINISHED_EARLY", "SKIPPED_RETROS", "PLAN_PENDING", "CALENDAR_BROKEN"];
export type AlertType = (typeof ALERT_TYPES)[number];
export declare const ALERT_SEVERITY: Record<AlertType, 'urgent' | 'attention' | 'scheduled'>;
