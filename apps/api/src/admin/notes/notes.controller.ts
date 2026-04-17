import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../../auth/strategies/jwt.strategy.js';
import { NotesService } from './notes.service.js';
import { CreateNoteSchema, UpdateNoteSchema } from './dto.js';

@Roles('ADMIN')
@Controller('admin/notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(@Query('aboutId') aboutId: string) {
    return this.notes.listForMember(aboutId);
  }

  @Post()
  create(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const parsed = CreateNoteSchema.parse(body);
    return this.notes.create({
      aboutId: parsed.aboutId,
      authorId: user.sub,
      text: parsed.text,
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtStrategyPayload,
    @Body() body: unknown,
  ) {
    const { text } = UpdateNoteSchema.parse(body);
    return this.notes.update(id, user.sub, text);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: JwtStrategyPayload) {
    await this.notes.delete(id, user.sub);
    return { ok: true };
  }
}
