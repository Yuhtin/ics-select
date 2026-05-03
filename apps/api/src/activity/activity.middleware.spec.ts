import { ActivityMiddleware } from './activity.middleware.js';

type EventRow = { occurredAt: Date };

function buildPrismaMock(latest: EventRow | null) {
  return {
    userEvent: {
      findFirst: jest.fn().mockResolvedValue(latest),
      create: jest.fn().mockResolvedValue(undefined),
    },
  };
}

function flushSetImmediate() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

describe('ActivityMiddleware', () => {
  const mw = (prisma: ReturnType<typeof buildPrismaMock>) =>
    new ActivityMiddleware(prisma as unknown as never);

  it('writes SESSION_START when user has no prior events', async () => {
    const prisma = buildPrismaMock(null);
    const next = jest.fn();
    const req = { user: { sub: 'u1' } } as unknown as never;
    const res = {} as never;

    await mw(prisma).use(req, res, next);
    expect(next).toHaveBeenCalled();
    await flushSetImmediate();

    expect(prisma.userEvent.create).toHaveBeenCalledWith({
      data: { userId: 'u1', type: 'SESSION_START' },
    });
  });

  it('writes SESSION_START when latest event is older than 30 minutes', async () => {
    const prisma = buildPrismaMock({
      occurredAt: new Date(Date.now() - 31 * 60 * 1000),
    });
    const next = jest.fn();
    const req = { user: { sub: 'u1' } } as unknown as never;

    await mw(prisma).use(req, {} as never, next);
    await flushSetImmediate();

    expect(prisma.userEvent.create).toHaveBeenCalledTimes(1);
  });

  it('does NOT write SESSION_START when latest event is within 30 minutes', async () => {
    const prisma = buildPrismaMock({
      occurredAt: new Date(Date.now() - 5 * 60 * 1000),
    });
    const next = jest.fn();
    await mw(prisma).use({ user: { sub: 'u1' } } as never, {} as never, next);
    await flushSetImmediate();

    expect(prisma.userEvent.create).not.toHaveBeenCalled();
  });

  it('skips when request has no authenticated user', async () => {
    const prisma = buildPrismaMock(null);
    const next = jest.fn();
    await mw(prisma).use({} as never, {} as never, next);
    await flushSetImmediate();

    expect(next).toHaveBeenCalled();
    expect(prisma.userEvent.findFirst).not.toHaveBeenCalled();
  });

  it('never throws when prisma fails — error is swallowed', async () => {
    const prisma = {
      userEvent: {
        findFirst: jest.fn().mockRejectedValue(new Error('boom')),
        create: jest.fn(),
      },
    };
    const next = jest.fn();
    await expect(
      mw(prisma as never).use({ user: { sub: 'u1' } } as never, {} as never, next),
    ).resolves.toBeUndefined();
    await flushSetImmediate();
    expect(next).toHaveBeenCalled();
  });
});
