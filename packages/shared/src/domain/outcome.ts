export const ITEM_OUTCOMES = [
  'PENDING',
  'DONE_EASY',
  'DONE_HARD',
  'DOUBTS',
  'STUCK',
] as const;

export type ItemOutcome = (typeof ITEM_OUTCOMES)[number];

export const POSITIVE_OUTCOMES: ReadonlySet<ItemOutcome> = new Set([
  'DONE_EASY',
  'DONE_HARD',
]);

export function isPositiveOutcome(o: ItemOutcome): boolean {
  return POSITIVE_OUTCOMES.has(o);
}
