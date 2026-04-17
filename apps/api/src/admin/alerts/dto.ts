import { z } from 'zod';
import { ALERT_TYPES } from '@ics-select/shared';

export const DismissAlertSchema = z.object({
  alertType: z.enum(ALERT_TYPES),
  targetId: z.string().min(1),
});
