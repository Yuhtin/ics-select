import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../../auth/strategies/jwt.strategy.js';
import { InvitesService } from './invites.service.js';
import { CreateInviteSchema } from './dto.js';

@Roles('ADMIN')
@Controller('admin/invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get()
  list() {
    return this.invites.list();
  }

  @Post()
  create(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const parsed = CreateInviteSchema.parse(body);
    return this.invites.create({
      email: parsed.email,
      role: parsed.role,
      cycleId: parsed.cycleId,
      createdById: user.sub,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await this.invites.delete(id);
  }
}
