import { Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { WeeklyPlansService } from './weekly-plans.service.js';
import { PublicationService } from './publication.service.js';
import {
  CreatePlanSchema,
  EditPublishedPlanSchema,
  PublishPlanSchema,
  SetItemOutcomeSchema,
  UpdatePlanSchema,
} from './dto.js';
import { LogEvent } from '../activity/log-event.decorator.js';

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
  publish(@Param('id') id: string, @Body() body: unknown) {
    const parsed = PublishPlanSchema.parse(body ?? {});
    return this.publication.publish(id, {
      publishAt: parsed.publishAt ?? null,
      sendWhatsapp: parsed.sendWhatsapp,
      autoSchedule: parsed.autoSchedule,
    });
  }

  @Roles('ADMIN')
  @Post('plans/:id/edit')
  async editPublished(@Param('id') id: string, @Body() body: unknown) {
    const parsed = EditPublishedPlanSchema.parse(body);
    const result = await this.publication.editPublished(
      id,
      { adminNotes: parsed.adminNotes, items: parsed.items },
      { force: parsed.force ?? false },
    );
    const plan = await this.plans.getByIdOrThrow(id);
    return { plan, scheduling: result };
  }

  @Roles('ADMIN')
  @Post('plans/:id/reschedule-pending')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reschedulePending(
    @Param('id') id: string,
    @Query('force') force: string | undefined,
    @Query('relax') relax: string | undefined,
  ) {
    await this.publication.reschedulePending(id, {
      force: force === 'true',
      relaxOrder: relax === 'true',
    });
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

  @Patch('plans/:planId/items/:itemId/outcome')
  @LogEvent('OUTCOME_MARKED', ({ body, request }) => {
    const r = request as { params: { itemId: string } };
    const b = body as { outcome: string; actualMinutes?: number | null };
    return { itemId: r.params.itemId, outcome: b.outcome, actualMinutes: b.actualMinutes ?? null };
  })
  setItemOutcome(
    @Param('planId') _planId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: JwtStrategyPayload,
    @Body() body: unknown,
  ) {
    const input = SetItemOutcomeSchema.parse(body);
    return this.plans.setItemOutcome(itemId, user.sub, {
      outcome: input.outcome,
      reflection: input.reflection,
      actualMinutes: input.actualMinutes ?? null,
    });
  }
}
