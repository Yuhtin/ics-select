import { z } from 'zod';

export const CreateInviteSchema = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;
