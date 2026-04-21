import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const expressApp = app.getHttpAdapter().getInstance();
  // Express instance — EasyPanel + Cloudflare proxy hop in prod. Without this,
  // req.ip reflects the proxy, not the client — throttler would then rate-limit
  // everyone as one.
  (expressApp as unknown as { set: (k: string, v: unknown) => void }).set('trust proxy', 1);

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use(cookieParser());

  app.enableCors({
    origin: env.CORS_ALLOWED_ORIGINS,
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  await app.listen(env.PORT);
  const logger = app.get(Logger);
  logger.log(`API listening on port ${env.PORT}`, 'Bootstrap');
}

void bootstrap();
