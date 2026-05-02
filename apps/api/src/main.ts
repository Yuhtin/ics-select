import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { requestTiming } from './common/middleware/request-timing.middleware.js';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);

  const expressApp = app.getHttpAdapter().getInstance();
  // Express instance — EasyPanel + Cloudflare proxy hop in prod. Without this,
  // req.ip reflects the proxy, not the client — throttler would then rate-limit
  // everyone as one.
  (expressApp as unknown as { set: (k: string, v: unknown) => void }).set('trust proxy', 1);

  app.useGlobalFilters(new HttpExceptionFilter(app.get(ConfigService)));
  app.use(cookieParser());
  app.use(requestTiming);

  app.enableCors({
    origin: env.CORS_ALLOWED_ORIGINS,
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  await app.listen(env.PORT);
  new Logger('Bootstrap').log(`API listening on port ${env.PORT}`);
}

void bootstrap();
