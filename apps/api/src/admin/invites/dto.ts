import { z } from 'zod';

export const CreateInviteSchema = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
  // Required for MEMBER invites — the cycle the new member auto-enrolls into
  // at first login. Optional for ADMIN invites (admins are not bound to a
  // cycle). Validated against existing non-ARCHIVED cycles in the service.
  cycleId: z.string().min(1).optional(),
});

export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;
