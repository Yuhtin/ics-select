import { z } from 'zod';

const COURSE_VALUES = [
  'CIENCIA_COMPUTACAO',
  'ADMINISTRACAO',
  'ENGENHARIA_SOFTWARE',
  'ENGENHARIA_COMPUTACAO',
  'SISTEMAS_INFORMACAO',
] as const;

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .url()
  .optional()
  .or(z.literal('').transform(() => undefined));

export const SubmitWaitlistSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(200),
  course: z.enum(COURSE_VALUES),
  skillLevel: z.number().int().min(1).max(5),
  github: optionalUrl,
  linkedin: optionalUrl,
  wantsUpdates: z.boolean().default(true),
  // Honeypot — if a bot fills this, the service silent-drops.
  website: z.string().max(500).optional(),
});

export type SubmitWaitlistDto = z.infer<typeof SubmitWaitlistSchema>;
export const WAITLIST_COURSES = COURSE_VALUES;
export type WaitlistCourse = (typeof COURSE_VALUES)[number];
