import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service.js';
import { AlertsController } from './alerts.controller.js';

@Module({
  providers: [AlertsService],
  controllers: [AlertsController],
})
export class AlertsModule {}
