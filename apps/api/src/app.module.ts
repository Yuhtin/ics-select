import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ActivityModule } from './activity/activity.module.js';
import { ActivityMiddleware } from './activity/activity.middleware.js';
import { LogEventInterceptor } from './activity/log-event.interceptor.js';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { OpenAiModule } from './common/openai/openai.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { UsersModule } from './users/users.module.js';
import { CyclesModule } from './cycles/cycles.module.js';
import { TopicsModule } from './topics/topics.module.js';
import { PrivacyModule } from './privacy/privacy.module.js';
import { LibraryModule } from './library/library.module.js';
import { GoogleCalendarModule } from './google-calendar/google-calendar.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { WeeklyPlansModule } from './weekly-plans/weekly-plans.module.js';
import { ClassesModule } from './classes/classes.module.js';
import { AdminDashboardModule } from './admin-dashboard/admin-dashboard.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AiModule } from './ai/ai.module.js';
import { WhatsappModule } from './whatsapp/whatsapp.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { MeModule } from './me/me.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { WaitlistModule } from './waitlist/waitlist.module.js';
import { PublicCohortModule } from './public-cohort/public-cohort.module.js';
import { loadEnv } from './config/env.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => {
          const env = loadEnv();
          return env as unknown as Record<string, unknown>;
        },
      ],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 600_000, // 10 minutes in ms
        limit: 5,
      },
    ]),
    PrismaModule,
    CryptoModule,
    OpenAiModule,
    AuthModule,
    UsersModule,
    CyclesModule,
    TopicsModule,
    PrivacyModule,
    LibraryModule,
    GoogleCalendarModule,
    AvailabilityModule,
    WeeklyPlansModule,
    ClassesModule,
    AdminDashboardModule,
    AdminModule,
    AiModule,
    WhatsappModule,
    NotificationsModule,
    MeModule,
    ReportsModule,
    WaitlistModule,
    PublicCohortModule,
    HealthModule,
    ActivityModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: LogEventInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ActivityMiddleware).forRoutes('*');
  }
}
