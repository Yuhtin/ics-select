import { z } from 'zod';

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

export const MarkItemDoneSchema = z.object({
  rating: z.enum(['EASY', 'HARD']).optional(),
  reflection: z.string().optional(),
});
