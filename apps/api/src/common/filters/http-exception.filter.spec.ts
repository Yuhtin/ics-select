import { ArgumentsHost, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

type Captured = { status?: number; body?: unknown };

function mockHost(): { host: ArgumentsHost; captured: Captured } {
  const captured: Captured = {};
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ url: '/test' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, captured };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('maps BadRequestException to 400 VALIDATION_ERROR', () => {
    const { host, captured } = mockHost();
    filter.catch(new BadRequestException('bad input'), host);
    expect(captured.status).toBe(400);
    expect(captured.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR', message: 'bad input' },
    });
  });

  it('maps InternalServerErrorException to 500 INTERNAL', () => {
    const { host, captured } = mockHost();
    filter.catch(new InternalServerErrorException('kapow'), host);
    expect(captured.status).toBe(500);
    expect(captured.body).toMatchObject({
      error: { code: 'INTERNAL' },
    });
  });

  it('maps unknown errors to 500 INTERNAL without leaking message', () => {
    const { host, captured } = mockHost();
    filter.catch(new Error('db password is hunter2'), host);
    expect(captured.status).toBe(500);
    expect((captured.body as { error: { message: string } }).error.message).not.toContain('hunter2');
  });
});
