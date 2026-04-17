import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { UsersService } from './users.service.js';

const InviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() current: JwtStrategyPayload) {
    const user = await this.users.getMeById(current.sub);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      pictureUrl: user.pictureUrl,
      role: user.role,
      privacyAcceptedAt: user.privacyAcceptedAt,
      whatsappPhone: user.whatsappPhone ?? null,
      targetTrack: user.membership?.track ?? null,
      googleConnected: user.googleConnected,
    };
  }

  @Roles('ADMIN')
  @Get('members')
  async list() {
    const users = await this.users.list();
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      pictureUrl: u.pictureUrl,
      role: u.role,
      createdAt: u.createdAt,
    }));
  }

  @Roles('ADMIN')
  @Get('members/:id')
  async get(@Param('id') id: string) {
    const user = await this.users.getById(id);
    if (!user) throw new NotFoundException('member not found');
    return user;
  }

  @Roles('ADMIN')
  @Post('members')
  async invite(@Body() body: unknown) {
    const parsed = InviteSchema.parse(body);
    return this.users.invite(parsed);
  }

  @Roles('ADMIN')
  @Delete('members/:id')
  async remove(@Param('id') id: string) {
    return this.users.deleteById(id);
  }
}
