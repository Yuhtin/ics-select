import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { PrivacyController } from './privacy.controller.js';

@Module({
  imports: [UsersModule],
  controllers: [PrivacyController],
})
export class PrivacyModule {}
