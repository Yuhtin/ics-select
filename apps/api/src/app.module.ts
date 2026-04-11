import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { OpenAiModule } from './common/openai/openai.module.js';
import { AnthropicModule } from './common/anthropic/anthropic.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { UsersModule } from './users/users.module.js';
import { CyclesModule } from './cycles/cycles.module.js';
import { PrivacyModule } from './privacy/privacy.module.js';
import { LibraryModule } from './library/library.module.js';
import { GoogleCalendarModule } from './google-calendar/google-calendar.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { WeeklyPlansModule } from './weekly-plans/weekly-plans.module.js';
import { ClassesModule } from './classes/classes.module.js';
import { AdminDashboardModule } from './admin-dashboard/admin-dashboard.module.js';
import { AiModule } from './ai/ai.module.js';
import { WhatsappModule } from './whatsapp/whatsapp.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { MeModule } from './me/me.module.js';
import { ReportsModule } from './reports/reports.module.js';
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
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    PrismaModule,
    CryptoModule,
    OpenAiModule,
    AnthropicModule,
    AuthModule,
    UsersModule,
    CyclesModule,
    PrivacyModule,
    LibraryModule,
    GoogleCalendarModule,
    AvailabilityModule,
    WeeklyPlansModule,
    ClassesModule,
    AdminDashboardModule,
    AiModule,
    WhatsappModule,
    NotificationsModule,
    MeModule,
    ReportsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
