// Centralizes the chart color palette so charts stay consistent with the design system.
// Outcome tokens map to Tremor's color names where they exist; the rest reuse ink/ink-soft.
import type { Color } from '@tremor/react';

export const OUTCOME_COLORS: Record<string, Color> = {
  DONE_EASY: 'emerald',  // matches --done-easy #065F46
  DONE_HARD: 'amber',    // matches --done-hard #B45309
  DOUBTS:    'violet',   // matches --doubts #6B21A8
  STUCK:     'red',      // matches --stuck #991B1B
  PENDING:   'gray',     // matches --pending
};

export const KPI_NEUTRAL: Color = 'gray';
export const KPI_BAD: Color = 'red';
export const KPI_GOOD: Color = 'emerald';
