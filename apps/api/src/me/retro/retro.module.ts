import { Module } from '@nestjs/common';
import { RetroService } from './retro.service.js';
import { RetroController } from './retro.controller.js';

@Module({ providers: [RetroService], controllers: [RetroController] })
export class RetroModule {}
