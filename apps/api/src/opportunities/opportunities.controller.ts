import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { OpportunityInputSchema } from '@ics-select/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { OpportunitiesService } from './opportunities.service.js';

function parse<T extends { safeParse(b: unknown): any }>(schema: T, body: unknown) {
  const r = schema.safeParse(body);
  if (!r.success) {
    const detail = r.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new BadRequestException(`invalid body — ${detail}`);
  }
  return r.data;
}

@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly service: OpportunitiesService) {}

  @Get()
  list(@CurrentUser() user: JwtStrategyPayload, @Query('interestedBy') interestedBy?: string) {
    return this.service.list(user, { interestedBy });
  }

  @Get(':id')
  get(@CurrentUser() user: JwtStrategyPayload, @Param('id') id: string) {
    return this.service.get(user, id);
  }

  @Post()
  create(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    return this.service.create(user, parse(OpportunityInputSchema, body));
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtStrategyPayload, @Param('id') id: string, @Body() body: unknown) {
    return this.service.update(user, id, parse(OpportunityInputSchema.partial(), body));
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Put(':id/interest')
  addInterest(@CurrentUser() user: JwtStrategyPayload, @Param('id') id: string) {
    return this.service.setInterest(user, id, true);
  }

  @Delete(':id/interest')
  removeInterest(@CurrentUser() user: JwtStrategyPayload, @Param('id') id: string) {
    return this.service.setInterest(user, id, false);
  }
}
