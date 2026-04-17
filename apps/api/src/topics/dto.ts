import { z } from 'zod';

export const CreateTopicSchema = z.object({
  slug: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(60),
  order: z.number().int().min(0).optional(),
});

export const UpdateTopicSchema = z.object({
  slug: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/).optional(),
  label: z.string().min(1).max(60).optional(),
  order: z.number().int().min(0).optional(),
});
