import { Module } from '@nestjs/common';
import { CycleReceiptService } from './cycle-receipt.service.js';
import { CycleReceiptController } from './cycle-receipt.controller.js';

@Module({
  providers: [CycleReceiptService],
  controllers: [CycleReceiptController],
})
export class CycleReceiptModule {}
