import { z } from 'zod';
import { WAITLIST_COURSES } from './submit-waitlist.dto.js';

// Query strings arrive as strings — coerce.
const int = z.coerce.number().int();

export const ListWaitlistQuerySchema = z.object({
  page:         int.min(1).default(1),
  pageSize:     int.min(1).max(200).default(50),
  course:       z.enum(WAITLIST_COURSES).optional(),
  skillMin:     int.min(1).max(5).optional(),
  skillMax:     int.min(1).max(5).optional(),
  q:            z.string().trim().min(1).max(200).optional(),
});

export type ListWaitlistQuery = z.infer<typeof ListWaitlistQuerySchema>;
