import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../../auth/strategies/jwt.strategy.js';
import { ItemService } from './item.service.js';
import { LogEvent } from '../../activity/log-event.decorator.js';

@Controller('me')
export class ItemController {
  constructor(private readonly item: ItemService) {}

  @Get('item/:id')
  @LogEvent('ITEM_VIEW', ({ request }) => ({
    itemId: (request as { params: { id: string } }).params.id,
  }))
  getItem(@Param('id') id: string, @CurrentUser() user: JwtStrategyPayload) {
    return this.item.getItem(id, user.sub);
  }
}
