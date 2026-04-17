import { Module } from '@nestjs/common';
import { ItemService } from './item.service.js';
import { ItemController } from './item.controller.js';

@Module({
  providers: [ItemService],
  controllers: [ItemController],
})
export class ItemModule {}
