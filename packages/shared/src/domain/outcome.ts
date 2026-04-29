export const ITEM_OUTCOMES = [
  'PENDING',
  'DONE_EASY',
  'DONE_HARD',
  'DOUBTS',
  'STUCK',
  'SKIPPED',
] as const;

export type ItemOutcome = (typeof ITEM_OUTCOMES)[number];

// "Positive" = the member engaged with the material to completion. DOUBTS
// belongs here because the study itself was done — the member just wants to
// go deeper later. The doubt is about future depth, not about whether the
// item was studied. Triage / progress / "finished" feed events all key off
// this set, so a DOUBTS item counts toward weekly progress and doesn't trip
// "disappeared" alerts.
export const POSITIVE_OUTCOMES: ReadonlySet<ItemOutcome> = new Set([
  'DONE_EASY',
  'DONE_HARD',
  'DOUBTS',
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
