import { Module } from '@nestjs/common';
import { OpportunitiesController } from './opportunities.controller.js';
import { OpportunitiesService } from './opportunities.service.js';

@Module({ controllers: [OpportunitiesController], providers: [OpportunitiesService] })
export class OpportunitiesModule {}
