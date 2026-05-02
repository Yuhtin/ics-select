import { Module } from '@nestjs/common';
import { ActivityMiddleware } from './activity.middleware.js';

@Module({
  providers: [ActivityMiddleware],
  exports: [ActivityMiddleware],
})
export class ActivityModule {}
