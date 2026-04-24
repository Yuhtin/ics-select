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

type ErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const { status, payload } = this.map(exception);

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json(payload);
  }

  private map(exception: unknown): { status: number; payload: ErrorPayload } {
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
