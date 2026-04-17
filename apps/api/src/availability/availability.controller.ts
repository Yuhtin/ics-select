import { Body, Controller, Get, Patch } from '@nestjs/common';
import { TRACKS } from '@ics-select/shared';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { AvailabilityService } from './availability.service.js';

const AvailabilitySchema = z.object({
  mondayMinutes: z.number().int().min(0).max(24 * 60),
  tuesdayMinutes: z.number().int().min(0).max(24 * 60),
  wednesdayMinutes: z.number().int().min(0).max(24 * 60),
  thursdayMinutes: z.number().int().min(0).max(24 * 60),
  fridayMinutes: z.number().int().min(0).max(24 * 60),
  saturdayMinutes: z.number().int().min(0).max(24 * 60),
  sundayMinutes: z.number().int().min(0).max(24 * 60),
  preferredSessionMinutes: z.number().int().min(15).max(240),
  timezone: z.string().default('America/Sao_Paulo'),
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
  upsert(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const parsed = AvailabilitySchema.parse(body);
    return this.availability.upsert(user.sub, parsed);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const input = UpdateProfileSchema.parse(body);
    return this.availability.updateProfile(user.sub, input);
  }
}
