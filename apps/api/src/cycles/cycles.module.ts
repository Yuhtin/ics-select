import { Module } from '@nestjs/common';
import { CyclesController } from './cycles.controller.js';
import { CyclesService } from './cycles.service.js';

@Module({
  controllers: [CyclesController],
  providers: [CyclesService],
  exports: [CyclesService],
})
export class CyclesModule {}
