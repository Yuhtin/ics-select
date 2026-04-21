import { Module } from '@nestjs/common';
import { AdminWaitlistController } from './admin-waitlist.controller.js';
import { WaitlistController } from './waitlist.controller.js';
import { WaitlistService } from './waitlist.service.js';

@Module({
  controllers: [WaitlistController, AdminWaitlistController],
  providers: [WaitlistService],
})
export class WaitlistModule {}
