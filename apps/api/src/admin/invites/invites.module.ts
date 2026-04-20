import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service.js';
import { InvitesController } from './invites.controller.js';

@Module({
  providers: [InvitesService],
  controllers: [InvitesController],
  exports: [InvitesService],
})
export class InvitesModule {}
