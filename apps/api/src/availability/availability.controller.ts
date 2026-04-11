import { Body, Controller, Get, Patch } from '@nestjs/common';
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

@Controller('me/availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  get(@CurrentUser() user: JwtStrategyPayload) {
    return this.availability.get(user.sub);
  }

  @Patch()
  upsert(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const parsed = AvailabilitySchema.parse(body);
    return this.availability.upsert(user.sub, parsed);
  }
}
