import {
  ArgumentsHost,
  BadRequestException,
  Catch,
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
