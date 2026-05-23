import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { MocksService } from './mocks.service.js';
import { CreateMockSchema, UpdateMockSchema } from './dto.js';

@Roles('ADMIN')
@Controller('admin/mocks')
export class MocksController {
  constructor(private readonly mocks: MocksService) {}

  // GET /admin/mocks?userId=...&cycleId=...
  // The cockpit reads this with the currently selected cycle so the list
  // matches the KPI scope. Omitting cycleId returns the full history.
  @Get()
  list(@Query('userId') userId: string, @Query('cycleId') cycleId?: string) {
    return this.mocks.listForMember(userId, cycleId ?? null);
  }

  @Post()
  create(@Body() body: unknown) {
    const parsed = CreateMockSchema.parse(body);
    return this.mocks.create(parsed);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateMockSchema.parse(body);
    return this.mocks.update(id, parsed);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.mocks.remove(id);
    return { ok: true };
  }
}
