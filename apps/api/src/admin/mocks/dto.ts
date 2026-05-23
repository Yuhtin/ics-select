import { z } from 'zod';

export const MOCK_TYPES = ['BEHAVIORAL', 'CODING', 'SYSTEM_DESIGN'] as const;
export type MockType = (typeof MOCK_TYPES)[number];

// Score is the hire-bar scale: 1=No Hire, 2=Lean No, 3=Borderline,
// 4=Lean Hire, 5=Strong Hire. Documented on the UI tooltip.
export const CreateMockSchema = z
  .object({
    userId: z.string().min(1),
    cycleId: z.string().min(1),
    type: z.enum(MOCK_TYPES),
    score: z.number().int().min(1).max(5),
    feedback: z.string().max(4000).optional(),
    conductedBy: z.string().max(120).optional(),
    conductedAt: z.coerce.date().optional(),
    topics: z.array(z.string().min(1).max(60)).max(20).optional(),
  })
  .strict();
export type CreateMockInput = z.infer<typeof CreateMockSchema>;

export const UpdateMockSchema = z
  .object({
    type: z.enum(MOCK_TYPES).optional(),
    score: z.number().int().min(1).max(5).optional(),
    feedback: z.string().max(4000).nullable().optional(),
    conductedBy: z.string().max(120).nullable().optional(),
    conductedAt: z.coerce.date().optional(),
    topics: z.array(z.string().min(1).max(60)).max(20).optional(),
  })
  .strict();
export type UpdateMockInput = z.infer<typeof UpdateMockSchema>;
