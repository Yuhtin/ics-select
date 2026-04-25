import { ArgumentsHost, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { z } from 'zod';
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

  it('passes through structured BadRequestException payloads', () => {
    const { host, captured } = mockHost();
    const structured = { error: { code: 'BAD_REQUEST', message: 'overlap: ...', details: { reason: 'overlap', dayOfWeek: 0 } } };
    filter.catch(new BadRequestException(structured), host);
    expect(captured.status).toBe(400);
    expect(captured.body).toEqual(structured);
  });

  it('maps InternalServerErrorException to 500 INTERNAL', () => {
    const { host, captured } = mockHost();
    filter.catch(new InternalServerErrorException('kapow'), host);
    expect(captured.status).toBe(500);
    expect(captured.body).toMatchObject({
      error: { code: 'INTERNAL' },
    });
  });

  it('maps ZodError to 400 VALIDATION with field-level details', () => {
    const { host, captured } = mockHost();
    const schema = z.object({ name: z.string().min(1), age: z.number().int() });
    let err: unknown;
    try {
      schema.parse({ name: '', age: 'twelve' });
    } catch (e) {
      err = e;
    }
    filter.catch(err, host);
    expect(captured.status).toBe(400);
    const body = captured.body as { error: { code: string; details: { issues: unknown } } };
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.details.issues).toBeDefined();
  });

  it('maps unknown errors to 500 INTERNAL without leaking message', () => {
    const { host, captured } = mockHost();
    filter.catch(new Error('db password is hunter2'), host);
    expect(captured.status).toBe(500);
    expect((captured.body as { error: { message: string } }).error.message).not.toContain('hunter2');
  });
});
