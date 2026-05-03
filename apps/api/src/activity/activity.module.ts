import { Module } from '@nestjs/common';
import { ActivityMiddleware } from './activity.middleware.js';
import { LogEventInterceptor } from './log-event.interceptor.js';

@Module({
  providers: [ActivityMiddleware, LogEventInterceptor],
  exports: [ActivityMiddleware, LogEventInterceptor],
})
export class ActivityModule {}
