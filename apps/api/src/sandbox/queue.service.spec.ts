import { SandboxQueueService, SandboxQueueTimeoutError } from './queue.service';

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('SandboxQueueService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.useRealTimers();
  });

  it('respects max concurrent and queues the overflow', async () => {
    process.env.SANDBOX_MAX_CONCURRENT = '2';
    const queue = new SandboxQueueService();

    const d1 = deferred();
    const d2 = deferred();
    const d3 = deferred();

    const p1 = queue.withSlot(() => d1.promise);
    const p2 = queue.withSlot(() => d2.promise);
    // p3 must wait — both slots are taken by p1 and p2.
    const p3 = queue.withSlot(() => d3.promise);

    // Yield once so withSlot internals run.
    await Promise.resolve();
    expect(queue.snapshot()).toEqual({ active: 2, waiting: 1, maxConcurrent: 2 });

    d1.resolve();
    await p1;
    // p3 should now have its slot.
    await Promise.resolve();
    expect(queue.snapshot()).toEqual({ active: 2, waiting: 0, maxConcurrent: 2 });

    d2.resolve();
    d3.resolve();
    await Promise.all([p2, p3]);
    expect(queue.snapshot()).toEqual({ active: 0, waiting: 0, maxConcurrent: 2 });
  });

  it('rejects waiters past the queue timeout', async () => {
    process.env.SANDBOX_MAX_CONCURRENT = '1';
    process.env.SANDBOX_QUEUE_TIMEOUT_MS = '50';
    const queue = new SandboxQueueService();
    const blocker = deferred();

    const long = queue.withSlot(() => blocker.promise);
    // Yield so the first acquire happens.
    await Promise.resolve();

    await expect(queue.withSlot(async () => 'never')).rejects.toBeInstanceOf(
      SandboxQueueTimeoutError,
    );
    blocker.resolve();
    await long;
  });

  it('falls back to defaults when env vars are absent', () => {
    delete process.env.SANDBOX_MAX_CONCURRENT;
    delete process.env.SANDBOX_QUEUE_TIMEOUT_MS;
    const queue = new SandboxQueueService();
    expect(queue.snapshot().maxConcurrent).toBe(4);
  });

  it('releases the slot even when fn throws', async () => {
    process.env.SANDBOX_MAX_CONCURRENT = '1';
    const queue = new SandboxQueueService();
    await expect(
      queue.withSlot(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    // Slot must be free for the next caller.
    const out = await queue.withSlot(async () => 'next');
    expect(out).toBe('next');
  });
});
