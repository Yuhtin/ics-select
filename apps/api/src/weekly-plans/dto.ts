import { z } from 'zod';
import { ITEM_OUTCOMES } from '@ics-select/shared';

const PlanItemSchema = z
  .object({
    libraryItemId: z.string().min(1),
    order: z.number().int().min(0),
  })
  .strict();

export const CreatePlanSchema = z
  .object({
    cycleId: z.string().min(1),
    weekStart: z.coerce.date(),
    weekEnd: z.coerce.date(),
    adminNotes: z.string().optional(),
    items: z.array(PlanItemSchema).min(1),
  })
  .strict()
  .refine((v) => v.weekEnd.getTime() > v.weekStart.getTime(), {
    message: 'weekEnd must be after weekStart',
    path: ['weekEnd'],
  });

export const UpdatePlanSchema = z
  .object({
    adminNotes: z.string().optional(),
    items: z.array(PlanItemSchema).optional(),
  })
  .strict();

export const PublishPlanSchema = z
  .object({
    publishAt: z.coerce.date().nullable().optional(),
    sendWhatsapp: z.boolean().optional(),
    autoSchedule: z.boolean().optional(),
  })
  .strict();
export type PublishPlanInput = z.infer<typeof PublishPlanSchema>;

export const EditPublishedPlanSchema = z
  .object({
    adminNotes: z.string().optional(),
    items: z.array(PlanItemSchema).min(1),
    force: z.boolean().optional(),
  })
  .strict();
export type EditPublishedPlanInput = z.infer<typeof EditPublishedPlanSchema>;

// Outcomes that require the member to report time spent. SKIPPED, STUCK
// and PENDING are excluded — the member either didn't study the item or
// already knew it, so there's no time to report. Mirrors the
// TIME_REQUIRED_OUTCOMES set on the web side (item-focus.tsx).
const TIME_REQUIRED_OUTCOMES = ['DONE_EASY', 'DONE_HARD', 'DOUBTS'] as const;

export const SetItemOutcomeSchema = z
  .object({
    outcome: z.enum(ITEM_OUTCOMES),
    reflection: z.string().max(2000).optional(),
    actualMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  })
  .strict()
  .refine(
    (v) =>
      !TIME_REQUIRED_OUTCOMES.includes(v.outcome as (typeof TIME_REQUIRED_OUTCOMES)[number]) ||
      (typeof v.actualMinutes === 'number'),
    {
      message: 'actualMinutes is required for DONE_EASY, DONE_HARD and DOUBTS',
      path: ['actualMinutes'],
    },
  );
export type SetItemOutcomeInput = z.infer<typeof SetItemOutcomeSchema>;
