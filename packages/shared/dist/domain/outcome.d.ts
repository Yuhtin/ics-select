export declare const ITEM_OUTCOMES: readonly ["PENDING", "DONE_EASY", "DONE_HARD", "DOUBTS", "STUCK"];
export type ItemOutcome = (typeof ITEM_OUTCOMES)[number];
export declare const POSITIVE_OUTCOMES: ReadonlySet<ItemOutcome>;
export declare function isPositiveOutcome(o: ItemOutcome): boolean;
export declare function summarizeOutcomes(items: ReadonlyArray<{
    outcome: ItemOutcome;
}>): Record<ItemOutcome, number>;
