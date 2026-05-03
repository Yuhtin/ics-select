import { Module } from '@nestjs/common';
import { CockpitController } from './cockpit.controller.js';
import { CockpitService } from './cockpit.service.js';

@Module({
  controllers: [CockpitController],
  providers: [CockpitService],
})
export class CockpitModule {}
