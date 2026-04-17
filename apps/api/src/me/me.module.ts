import { Module } from '@nestjs/common';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';
import { HomeModule } from './home/home.module.js';
import { ItemModule } from './item/item.module.js';
import { CohortModule } from './cohort/cohort.module.js';
import { RetroModule } from './retro/retro.module.js';

@Module({
  imports: [HomeModule, ItemModule, CohortModule, RetroModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
