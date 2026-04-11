import { Module } from '@nestjs/common';
import { EvolutionApiClient } from './evolution.client.js';
import { WhatsappService } from './whatsapp.service.js';
import { WhatsappController } from './whatsapp.controller.js';

@Module({
  controllers: [WhatsappController],
  providers: [EvolutionApiClient, WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
