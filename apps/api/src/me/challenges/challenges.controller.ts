import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../../auth/strategies/jwt.strategy.js';
import { ChallengesService } from './challenges.service.js';
import {
  AutoSaveCodeSchema,
  RunChallengeSchema,
  StartChallengeSchema,
  SubmitChallengeSchema,
} from './dto.js';

@Controller('me/challenges')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Post('start')
  start(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const parsed = StartChallengeSchema.parse(body);
    return this.challenges.start(user.sub, parsed);
  }

  @Post(':id/run')
  run(
    @Param('id') id: string,
    @CurrentUser() user: JwtStrategyPayload,
    @Body() body: unknown,
  ) {
    const parsed = RunChallengeSchema.parse(body);
    return this.challenges.run(user.sub, id, parsed);
  }

  @Post(':id/submit')
  submit(
    @Param('id') id: string,
    @CurrentUser() user: JwtStrategyPayload,
    @Body() body: unknown,
  ) {
    const parsed = SubmitChallengeSchema.parse(body);
    return this.challenges.submit(user.sub, id, parsed);
  }

  @Post(':id/abandon')
  abandon(@Param('id') id: string, @CurrentUser() user: JwtStrategyPayload) {
    return this.challenges.abandon(user.sub, id);
  }

  // Auto-save: localStorage holds the canonical copy on the client; this
  // endpoint is the every-10s server flush so reload-from-other-device
  // recovers nicely.
  @Post(':id/code')
  autoSave(
    @Param('id') id: string,
    @CurrentUser() user: JwtStrategyPayload,
    @Body() body: unknown,
  ) {
    const parsed = AutoSaveCodeSchema.parse(body);
    return this.challenges.autoSaveCode(user.sub, id, parsed);
  }

  @Get()
  listForItem(
    @CurrentUser() user: JwtStrategyPayload,
    @Query('libraryItemId') libraryItemId: string,
  ) {
    if (!libraryItemId) {
      throw new BadRequestException('libraryItemId is required');
    }
    return this.challenges.listForMemberOnItem(user.sub, libraryItemId);
  }

  @Get('cohort')
  cohortForItem(
    @CurrentUser() user: JwtStrategyPayload,
    @Query('libraryItemId') libraryItemId: string,
  ) {
    if (!libraryItemId) {
      throw new BadRequestException('libraryItemId is required');
    }
    return this.challenges.cohortForItem(user.sub, libraryItemId);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: JwtStrategyPayload) {
    return this.challenges.getAttempt(user.sub, id);
  }
}
