export type PhaseKey =
  | 'foundations'
  | 'algorithms'
  | 'engineering'
  | 'sd-blocks'
  | 'sd-concepts'
  | 'sd-cases';

export const PHASES: { key: PhaseKey; label: string }[] = [
  { key: 'foundations', label: 'Foundations' },
  { key: 'algorithms', label: 'Algorithms & DS' },
  { key: 'engineering', label: 'Eng. Fundamentals' },
  { key: 'sd-blocks', label: 'SD · Building Blocks' },
  { key: 'sd-concepts', label: 'SD · Concepts' },
  { key: 'sd-cases', label: 'SD · Case Studies' },
];

// Phase derives from the Topic.order ranges defined in apps/api/scripts/seed-library.ts.
// Keep in sync if the seed's order ranges change.
export function topicPhase(order: number): PhaseKey {
  if (order < 0) return 'foundations';
  if (order < 20) return 'algorithms';
  if (order < 30) return 'engineering';
  if (order < 40) return 'sd-blocks';
  if (order < 50) return 'sd-concepts';
  return 'sd-cases';
}
