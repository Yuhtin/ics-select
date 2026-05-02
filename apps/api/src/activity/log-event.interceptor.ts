import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { LOG_EVENT_KEY, type LogEventConfig } from './log-event.decorator.js';

type AuthedRequest = { user?: { sub: string }; body?: unknown };

@Injectable()
export class LogEventInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LogEventInterceptor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const config = this.reflector.get<LogEventConfig | undefined>(
      LOG_EVENT_KEY,
      context.getHandler(),
    );
    if (!config) return next.handle();

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const userId = req.user?.sub;
    if (!userId) return next.handle();

    return next.handle().pipe(
      tap((result) => {
        setImmediate(() => {
          void this.write(userId, config, req, result);
        });
      }),
    );
  }

  private async write(
    userId: string,
    config: LogEventConfig,
    req: AuthedRequest,
    result: unknown,
  ): Promise<void> {
    try {
      const meta = config.meta?.({ request: req, result, body: req.body });
      await this.prisma.userEvent.create({
        data: { userId, type: config.type, meta: meta as never },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to log ${config.type} for ${userId}: ${(err as Error).message}`,
      );
    }
  }
}
