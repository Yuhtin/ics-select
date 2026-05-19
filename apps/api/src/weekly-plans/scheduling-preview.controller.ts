import { Body, Controller, NotFoundException, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { SchedulingPreviewService } from './scheduling-preview.service.js';

type PreviewBodyDto = {
  items?: Array<{ libraryItemId: string; order: number; estimatedMinutes?: number }>;
  relaxOrder?: boolean;
};

@Controller()
export class SchedulingPreviewController {
  constructor(
    private readonly preview: SchedulingPreviewService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles('ADMIN')
  @Post('plans/:id/preview-scheduling')
  async run(
    @Param('id') id: string,
    @Body() body: PreviewBodyDto,
    @CurrentUser() user: JwtStrategyPayload,
  ) {
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!plan) throw new NotFoundException('plan not found');
    if (user.role !== 'ADMIN' && plan.userId !== user.sub) {
      throw new NotFoundException('plan not found');
    }
    return this.preview.preview(id, {
      items: body?.items,
      relaxOrder: body?.relaxOrder ?? false,
    });
  }
}
