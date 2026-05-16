import { Body, Controller, Get, Patch } from '@nestjs/common';
import { TRACKS } from '@ics-select/shared';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { AvailabilityService } from './availability.service.js';
import { LogEvent } from '../activity/log-event.decorator.js';

const SlotSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1410),
    endMinute: z.number().int().min(30).max(1440),
  })
  .refine((s) => s.endMinute > s.startMinute, {
    message: 'endMinute must be greater than startMinute',
  });

const nullableDayCap = z
  .number()
  .int()
  .min(0)
  .max(24 * 60)
  .nullable()
  .optional();

const AvailabilityPatchSchema = z.object({
  mondayMinutes: nullableDayCap,
  tuesdayMinutes: nullableDayCap,
  wednesdayMinutes: nullableDayCap,
  thursdayMinutes: nullableDayCap,
  fridayMinutes: nullableDayCap,
  saturdayMinutes: nullableDayCap,
  sundayMinutes: nullableDayCap,
  preferredSessionMinutes: z.number().int().min(15).max(240).optional(),
  timezone: z.string().optional(),
  calendarBusy: z.boolean().optional(),
  slots: z.array(SlotSchema).optional(),
  clearDays: z.array(z.number().int().min(0).max(6)).optional(),
});

const UpdateProfileSchema = z.object({
  whatsappPhone: z
    .string()
    .regex(/^\+\d{8,15}$/)
    .nullable()
    .optional(),
  targetTrack: z.enum(TRACKS).nullable().optional(),
});

@Controller('me')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get('availability')
  get(@CurrentUser() user: JwtStrategyPayload) {
    return this.availability.get(user.sub);
  }

  @Patch('availability')
  @LogEvent('AVAILABILITY_SAVED')
  upsert(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const parsed = AvailabilityPatchSchema.parse(body);
    return this.availability.upsert(user.sub, parsed);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const input = UpdateProfileSchema.parse(body);
    return this.availability.updateProfile(user.sub, input);
  }
}
