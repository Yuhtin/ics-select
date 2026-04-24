import { Module } from '@nestjs/common';
import { EvolutionApiClient } from './evolution.client.js';
import { WhatsappService } from './whatsapp.service.js';
import { WhatsappTemplateService } from './whatsapp-template.service.js';
import { WhatsappController } from './whatsapp.controller.js';
import { WhatsappTemplateController } from './whatsapp-template.controller.js';

@Module({
  controllers: [WhatsappController, WhatsappTemplateController],
  providers: [EvolutionApiClient, WhatsappService, WhatsappTemplateService],
  exports: [WhatsappService, WhatsappTemplateService],
})
export class WhatsappModule {}
