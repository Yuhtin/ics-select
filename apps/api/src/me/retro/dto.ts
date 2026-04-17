import { z } from 'zod';

export const SubmitRetroSchema = z.object({
  whatClicked: z.string().max(1000).optional(),
  whatStuck: z.string().max(1000).optional(),
  nextWeekWish: z.string().max(1000).optional(),
});
export type SubmitRetroInput = z.infer<typeof SubmitRetroSchema>;
