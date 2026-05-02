import { z } from 'zod';

// whatClicked and whatStuck retain their column names for migration cost
// reasons but their semantics shifted: whatClicked = "why this item was
// valued" (Q2), whatStuck = "what's blocking on this item" (Q1).
export const SubmitRetroSchema = z.object({
  whatClicked: z.string().max(1000).optional(),
  whatStuck: z.string().max(1000).optional(),
  nextWeekWish: z.string().max(1000).optional(),
  // FK to the WeeklyPlanItem the member picked as "most valued" in Q2.
  // null/undefined = no item linked (free-text retro still allowed).
  valuedItemId: z.string().cuid().nullable().optional(),
  // FK to the WeeklyPlanItem the member picked as "stuck/in doubt" in Q1.
  stuckItemId: z.string().cuid().nullable().optional(),
});
export type SubmitRetroInput = z.infer<typeof SubmitRetroSchema>;
