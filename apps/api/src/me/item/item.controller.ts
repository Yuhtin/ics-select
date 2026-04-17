import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../../auth/strategies/jwt.strategy.js';
import { ItemService } from './item.service.js';

@Controller('me')
export class ItemController {
  constructor(private readonly item: ItemService) {}

  @Get('item/:id')
  getItem(@Param('id') id: string, @CurrentUser() user: JwtStrategyPayload) {
    return this.item.getItem(id, user.sub);
  }
}
