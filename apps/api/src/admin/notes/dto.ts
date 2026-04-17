import { z } from 'zod';

export const CreateNoteSchema = z.object({
  aboutId: z.string().min(1),
  text: z.string().min(1).max(2000),
});

export const UpdateNoteSchema = z.object({
  text: z.string().min(1).max(2000),
});
