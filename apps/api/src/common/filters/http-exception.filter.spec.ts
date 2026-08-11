import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { HttpExceptionFilter } from './http-exception.filter';

type Captured = { status?: number; body?: unknown; redirect?: string };

function mockHost(path = '/test'): { host: ArgumentsHost; captured: Captured } {
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
    redirect(url: string) {
      captured.redirect = url;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ path, url: path }),
    }),
  } as unknown as ArgumentsHost;
  return { host, captured };
}

const config = {
  getOrThrow: (key: string) =>
    key === 'FRONTEND_BASE_URL' ? 'https://ics.example.com' : '',
} as unknown as ConfigService;

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter(config);

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

  it('keeps a handler-built envelope at 5xx instead of masking it', () => {
    const { host, captured } = mockHost();
    filter.catch(
      new HttpException(
        { error: { code: 'AI_UPSTREAM', message: 'model gpt-x does not exist' } },
        502,
      ),
      host,
    );
    expect(captured.status).toBe(502);
    const body = captured.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe('AI_UPSTREAM');
    expect(body.error.message).toContain('gpt-x');
  });

  it('redirects OAuth TokenError on /auth/google/callback to /login?error=auth_retry', () => {
    const { host, captured } = mockHost('/auth/google/callback');
    const err = new Error('Bad Request');
    err.name = 'TokenError';
    filter.catch(err, host);
    expect(captured.redirect).toBe('https://ics.example.com/login?error=auth_retry');
    expect(captured.status).toBeUndefined();
    expect(captured.body).toBeUndefined();
  });

  it('falls through to JSON 500 for non-OAuth errors on the callback path', () => {
    const { host, captured } = mockHost('/auth/google/callback');
    filter.catch(new Error('something else broke'), host);
    expect(captured.redirect).toBeUndefined();
    expect(captured.status).toBe(500);
  });
});
