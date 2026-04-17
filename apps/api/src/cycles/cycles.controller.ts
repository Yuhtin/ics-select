import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CyclesService } from './cycles.service.js';

const CreateCycleSchema = z.object({
  name: z.string().min(1),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

const UpdateCycleSchema = CreateCycleSchema.partial().extend({
  rankingVisibleToMembers: z.boolean().optional(),
});

const AddMemberSchema = z.object({
  userId: z.string().min(1),
});

@Roles('ADMIN')
@Controller('cycles')
export class CyclesController {
  constructor(private readonly cycles: CyclesService) {}

  @Post()
  create(@Body() body: unknown) {
    const parsed = CreateCycleSchema.parse(body);
    return this.cycles.create(parsed);
  }

  @Get()
  list() {
    return this.cycles.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.cycles.getById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateCycleSchema.parse(body);
    return this.cycles.update(id, parsed);
  }

  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.cycles.archive(id);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() body: unknown) {
    const { userId } = AddMemberSchema.parse(body);
    return this.cycles.addMember(id, userId);
  }

  @Delete(':id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.cycles.removeMember(id, userId);
  }
}
