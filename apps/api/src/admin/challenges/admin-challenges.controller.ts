import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { AdminChallengesService } from './admin-challenges.service.js';

@Roles('ADMIN')
@Controller('admin/challenges')
export class AdminChallengesController {
  constructor(private readonly challenges: AdminChallengesService) {}

  @Get()
  list(
    @Query('userId') userId: string,
    @Query('cycleId') cycleId?: string,
  ) {
    return this.challenges.listForMember(userId, cycleId ?? null);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.challenges.remove(id);
    return { ok: true };
  }
}
