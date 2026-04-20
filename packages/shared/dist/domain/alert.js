"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALERT_SEVERITY = exports.ALERT_TYPES = void 0;
exports.ALERT_TYPES = [
    'STUCK_RECENT',
    'DISAPPEARED',
    'STUCK_REPEATEDLY',
    'FINISHED_EARLY',
    'SKIPPED_RETROS',
    'PLAN_PENDING',
    'CALENDAR_BROKEN',
];
exports.ALERT_SEVERITY = {
    STUCK_RECENT: 'urgent',
    DISAPPEARED: 'urgent',
    CALENDAR_BROKEN: 'urgent',
    STUCK_REPEATEDLY: 'attention',
    FINISHED_EARLY: 'attention',
    SKIPPED_RETROS: 'attention',
    PLAN_PENDING: 'scheduled',
};
