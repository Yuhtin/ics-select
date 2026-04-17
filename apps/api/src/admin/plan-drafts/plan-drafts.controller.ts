import { Body, Controller, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { PlanDraftsService } from './plan-drafts.service.js';

const GetOrCreateSchema = z.object({
  weekStart: z.coerce.date().optional(),
});

@Roles('ADMIN')
@Controller('admin/member')
export class PlanDraftsController {
  constructor(private readonly drafts: PlanDraftsService) {}

  @Post(':id/plan-drafts')
  getOrCreate(@Param('id') id: string, @Body() body: unknown) {
    const { weekStart } = GetOrCreateSchema.parse(body ?? {});
    return this.drafts.getOrCreateDraft({ memberId: id, weekStart });
  }
}
