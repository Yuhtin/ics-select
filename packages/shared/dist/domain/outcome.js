"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSITIVE_OUTCOMES = exports.ITEM_OUTCOMES = void 0;
exports.isPositiveOutcome = isPositiveOutcome;
exports.summarizeOutcomes = summarizeOutcomes;
exports.ITEM_OUTCOMES = [
    'PENDING',
    'DONE_EASY',
    'DONE_HARD',
    'DOUBTS',
    'STUCK',
];
exports.POSITIVE_OUTCOMES = new Set([
    'DONE_EASY',
    'DONE_HARD',
]);
function isPositiveOutcome(o) {
    return exports.POSITIVE_OUTCOMES.has(o);
}
function summarizeOutcomes(items) {
    const counts = {
        PENDING: 0,
        DONE_EASY: 0,
        DONE_HARD: 0,
        DOUBTS: 0,
        STUCK: 0,
    };
    for (const item of items)
        counts[item.outcome]++;
    return counts;
}
