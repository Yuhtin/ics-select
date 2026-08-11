import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZodError } from 'zod';

type ErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

// Errors thrown inside passport-google-oauth20 strategy code (token exchange,
// profile fetch) before the controller handler runs. Most common cause:
// the auth code was already used / expired / revoked — typically because
// the user hit back/refresh, or there was a network hiccup between us and
// Google. Without special handling the user sees a raw 500 INTERNAL.
function isOAuthFlowError(exception: unknown): boolean {
  if (!exception || typeof exception !== 'object') return false;
  const name = (exception as { name?: string }).name;
  return name === 'TokenError' || name === 'InternalOAuthError';
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly config: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<{ path?: string; url?: string }>();
    const response = ctx.getResponse();

    // Special case: Google OAuth callback failures (TokenError /
    // InternalOAuthError) are user-visible — passport throws before the
    // controller runs, the user sees the raw API response. Bounce them
    // back to /login with a friendly error code so the UI can render a
    // "try again" message instead of a JSON dump.
    const path = request.path ?? request.url ?? '';
    if (path.startsWith('/auth/google/callback') && isOAuthFlowError(exception)) {
      const frontend = this.config.getOrThrow<string>('FRONTEND_BASE_URL');
      const url = new URL('/login', frontend);
      url.searchParams.set('error', 'auth_retry');
      this.logger.warn(
        `OAuth callback ${(exception as { name?: string }).name}: ${(exception as Error).message ?? 'unknown'} — redirecting to ${url.toString()}`,
      );
      response.redirect(url.toString());
      return;
    }

    const { status, payload } = this.map(exception);

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json(payload);
  }

  private map(exception: unknown): { status: number; payload: ErrorPayload } {
    if (exception instanceof ZodError) {
      // Controllers that call Schema.parse(body) inline used to bubble ZodError
      // straight through to the default 500. Map to 400 with field-level
      // details so clients can show useful inline errors.
      return {
        status: 400,
        payload: {
          error: {
            code: 'VALIDATION',
            message: 'Invalid request payload',
            details: { issues: exception.flatten() },
          },
        },
      };
    }
    if (exception instanceof BadRequestException) {
      const res = exception.getResponse();
      if (
        typeof res === 'object' &&
        res !== null &&
        'error' in res &&
        typeof (res as Record<string, unknown>).error === 'object'
      ) {
        return { status: 400, payload: res as ErrorPayload };
      }
      return {
        status: 400,
        payload: {
          error: { code: 'VALIDATION_ERROR', message: exception.message },
        },
      };
    }
    if (exception instanceof UnauthorizedException) {
      return {
        status: 401,
        payload: { error: { code: 'UNAUTHENTICATED', message: exception.message } },
      };
    }
    if (exception instanceof ForbiddenException) {
      return {
        status: 403,
        payload: { error: { code: 'FORBIDDEN', message: exception.message } },
      };
    }
    if (exception instanceof NotFoundException) {
      return {
        status: 404,
        payload: { error: { code: 'NOT_FOUND', message: exception.message } },
      };
    }
    if (exception instanceof ConflictException) {
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null && 'error' in res) {
        return { status: 409, payload: res as ErrorPayload };
      }
      return {
        status: 409,
        payload: { error: { code: 'CONFLICT', message: exception.message } },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      // A handler that built its own envelope keeps it, even at 5xx: the
      // generic mask below hides the only detail worth having (see the AI
      // routes, where the upstream message is the whole diagnosis).
      // `error` must be our envelope object — Nest's own 5xx responses carry
      // `error: 'Internal Server Error'` as a string plus the raw message,
      // and those stay masked.
      const res = exception.getResponse();
      if (
        typeof res === 'object' &&
        res !== null &&
        typeof (res as Record<string, unknown>).error === 'object'
      ) {
        return { status, payload: res as ErrorPayload };
      }
      return {
        status,
        payload: {
          error: {
            code: status >= 500 ? 'INTERNAL' : 'HTTP_ERROR',
            message: status >= 500 ? 'Internal server error' : exception.message,
          },
        },
      };
    }
    return {
      status: 500,
      payload: { error: { code: 'INTERNAL', message: 'Internal server error' } },
    };
  }
}
