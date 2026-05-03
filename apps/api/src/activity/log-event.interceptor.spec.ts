import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { LogEventInterceptor } from './log-event.interceptor.js';

function makeContext(req: { user?: { sub: string }; body?: unknown }): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function makeReflectorReturning(value: unknown) {
  return { get: jest.fn().mockReturnValue(value) } as unknown as Reflector;
}

function flushSetImmediate() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

describe('LogEventInterceptor', () => {
  it('writes the event after a successful handler', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const prisma = { userEvent: { create } } as never;
    const reflector = makeReflectorReturning({ type: 'PLAN_VIEW' });
    const interceptor = new LogEventInterceptor(prisma, reflector);

    const handler: CallHandler = { handle: () => of({ planId: 'p1' }) };
    const ctx = makeContext({ user: { sub: 'u1' } });

    await firstValueFrom(interceptor.intercept(ctx, handler));
    await flushSetImmediate();

    expect(create).toHaveBeenCalledWith({
      data: { userId: 'u1', type: 'PLAN_VIEW', meta: undefined },
    });
  });

  it('passes meta from extractor', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const prisma = { userEvent: { create } } as never;
    const reflector = makeReflectorReturning({
      type: 'OUTCOME_MARKED',
      meta: ({ body, result }: { body: unknown; result: unknown }) => ({ body, result }),
    });
    const interceptor = new LogEventInterceptor(prisma, reflector);

    const handler: CallHandler = { handle: () => of({ ok: true }) };
    const ctx = makeContext({ user: { sub: 'u1' }, body: { outcome: 'STUCK' } });

    await firstValueFrom(interceptor.intercept(ctx, handler));
    await flushSetImmediate();

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        type: 'OUTCOME_MARKED',
        meta: { body: { outcome: 'STUCK' }, result: { ok: true } },
      },
    });
  });

  it('does NOT write when no @LogEvent metadata', async () => {
    const create = jest.fn();
    const prisma = { userEvent: { create } } as never;
    const reflector = makeReflectorReturning(undefined);
    const interceptor = new LogEventInterceptor(prisma, reflector);

    const handler: CallHandler = { handle: () => of({}) };
    const ctx = makeContext({ user: { sub: 'u1' } });

    await firstValueFrom(interceptor.intercept(ctx, handler));
    await flushSetImmediate();

    expect(create).not.toHaveBeenCalled();
  });

  it('does NOT write when handler throws', async () => {
    const create = jest.fn();
    const prisma = { userEvent: { create } } as never;
    const reflector = makeReflectorReturning({ type: 'PLAN_VIEW' });
    const interceptor = new LogEventInterceptor(prisma, reflector);

    const handler: CallHandler = { handle: () => throwError(() => new Error('boom')) };
    const ctx = makeContext({ user: { sub: 'u1' } });

    await expect(firstValueFrom(interceptor.intercept(ctx, handler))).rejects.toThrow('boom');
    await flushSetImmediate();
    expect(create).not.toHaveBeenCalled();
  });

  it('swallows prisma errors silently', async () => {
    const create = jest.fn().mockRejectedValue(new Error('db down'));
    const prisma = { userEvent: { create } } as never;
    const reflector = makeReflectorReturning({ type: 'PLAN_VIEW' });
    const interceptor = new LogEventInterceptor(prisma, reflector);

    const handler: CallHandler = { handle: () => of({}) };
    const ctx = makeContext({ user: { sub: 'u1' } });

    await firstValueFrom(interceptor.intercept(ctx, handler));
    await flushSetImmediate();
    // Test passes if no unhandled rejection is thrown
  });
});
