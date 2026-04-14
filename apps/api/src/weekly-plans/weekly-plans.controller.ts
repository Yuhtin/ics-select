import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { WeeklyPlansService } from './weekly-plans.service.js';
import { PublicationService } from './publication.service.js';
import { CreatePlanSchema, MarkItemDoneSchema, UpdatePlanSchema } from './dto.js';

@Controller()
export class WeeklyPlansController {
  constructor(
    private readonly plans: WeeklyPlansService,
    private readonly publication: PublicationService,
  ) {}

  @Roles('ADMIN')
  @Post('members/:memberId/plans')
  create(@Param('memberId') memberId: string, @Body() body: unknown) {
    const parsed = CreatePlanSchema.parse(body);
    return this.plans.createDraft({ userId: memberId, ...parsed });
  }

  @Roles('ADMIN')
  @Patch('plans/:id')
  update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdatePlanSchema.parse(body);
    return this.plans.update(id, parsed);
  }

  @Roles('ADMIN')
  @Delete('plans/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.plans.remove(id);
  }

  @Roles('ADMIN')
  @Post('plans/:id/publish')
  publish(@Param('id') id: string) {
    return this.publication.publish(id);
  }

  @Post('plans/:id/auto-schedule')
  async autoSchedule(
    @Param('id') id: string,
    @Query('force') force: string | undefined,
    @CurrentUser() user: JwtStrategyPayload,
  ) {
    const plan = await this.plans.getById(id);
    if (!plan) throw new NotFoundException('plan not found');
    if (user.role !== 'ADMIN' && plan.userId !== user.sub) {
      throw new NotFoundException('plan not found');
    }
    return this.publication.autoSchedule(id, force === 'true');
  }

  @Get('plans/:id')
  async get(@Param('id') id: string, @CurrentUser() user: JwtStrategyPayload) {
    const plan = await this.plans.getById(id);
    if (!plan) throw new NotFoundException('plan not found');
    if (user.role !== 'ADMIN' && plan.userId !== user.sub) {
      throw new NotFoundException('plan not found');
    }
    return plan;
  }

  @Get('members/:memberId/plans')
  listForMember(@Param('memberId') memberId: string, @CurrentUser() user: JwtStrategyPayload) {
    if (user.role !== 'ADMIN' && user.sub !== memberId) {
      throw new NotFoundException('not found');
    }
    return this.plans.listForMember(memberId);
  }

  @Get('me/plans')
  myPlans(@CurrentUser() user: JwtStrategyPayload) {
    return this.plans.listAllForMember(user.sub);
  }

  @Get('me/cohort/progress')
  myCohortProgress(@CurrentUser() user: JwtStrategyPayload) {
    return this.plans.cohortProgress(user.sub);
  }

  @Get('me/week')
  myWeek(@CurrentUser() user: JwtStrategyPayload) {
    return this.plans.listForMember(user.sub);
  }

  @Post('plans/:planId/items/:itemId/done')
  markDone(
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtStrategyPayload,
  ) {
    const parsed = MarkItemDoneSchema.parse(body);
    return this.plans.markItemDone(planId, itemId, user.sub, parsed);
  }

  @Post('plans/:planId/items/:itemId/stuck')
  markStuck(
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: JwtStrategyPayload,
  ) {
    return this.plans.markItemStuck(planId, itemId, user.sub);
  }
}
