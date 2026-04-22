export const ITEM_OUTCOMES = [
  'PENDING',
  'DONE_EASY',
  'DONE_HARD',
  'DOUBTS',
  'STUCK',
  'SKIPPED',
] as const;

export type ItemOutcome = (typeof ITEM_OUTCOMES)[number];

export const POSITIVE_OUTCOMES: ReadonlySet<ItemOutcome> = new Set([
  'DONE_EASY',
  'DONE_HARD',
  'SKIPPED',
]);

export function isPositiveOutcome(o: ItemOutcome): boolean {
  return POSITIVE_OUTCOMES.has(o);
}

export function isSkipped(o: ItemOutcome): boolean {
  return o === 'SKIPPED';
}

export function summarizeOutcomes(
  items: ReadonlyArray<{ outcome: ItemOutcome }>,
): Record<ItemOutcome, number> {
  const counts: Record<ItemOutcome, number> = {
    PENDING: 0,
    DONE_EASY: 0,
    DONE_HARD: 0,
    DOUBTS: 0,
    STUCK: 0,
    SKIPPED: 0,
  };
  for (const item of items) counts[item.outcome]++;
  return counts;
}
