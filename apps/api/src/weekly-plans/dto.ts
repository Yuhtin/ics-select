import { z } from 'zod';
import { ITEM_OUTCOMES } from '@ics-select/shared';

export const CreatePlanSchema = z.object({
  cycleId: z.string().min(1),
  weekStart: z.coerce.date(),
  weekEnd: z.coerce.date(),
  adminNotes: z.string().optional(),
  items: z
    .array(
      z.object({
        libraryItemId: z.string().min(1),
        order: z.number().int().min(0),
      }),
    )
    .min(1),
});

export const UpdatePlanSchema = z.object({
  adminNotes: z.string().optional(),
  items: z
    .array(
      z.object({
        libraryItemId: z.string().min(1),
        order: z.number().int().min(0),
      }),
    )
    .optional(),
});

export const PublishPlanSchema = z.object({
  publishAt: z.coerce.date().nullable().optional(),
  sendWhatsapp: z.boolean().optional(),
  autoSchedule: z.boolean().optional(),
});
export type PublishPlanInput = z.infer<typeof PublishPlanSchema>;

export const SetItemOutcomeSchema = z.object({
  outcome: z.enum(ITEM_OUTCOMES),
  reflection: z.string().max(2000).optional(),
});
export type SetItemOutcomeInput = z.infer<typeof SetItemOutcomeSchema>;
