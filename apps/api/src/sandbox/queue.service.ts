import { Injectable, Logger } from '@nestjs/common';

const DEFAULT_MAX_CONCURRENT = 4;
const DEFAULT_QUEUE_TIMEOUT_MS = 30_000;

type Waiter = {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

/**
 * Counting semaphore that gates how many sandbox containers can run at the
 * same time on the VPS. Reading this number from env makes it tunable
 * without a redeploy: if the VPS shows CPU starvation under load, drop
 * SANDBOX_MAX_CONCURRENT from 4 to 2 and restart the API.
 *
 * Requests that cannot acquire within SANDBOX_QUEUE_TIMEOUT_MS reject with
 * a SandboxQueueTimeoutError. The frontend translates that into "too much
 * traffic right now, try again in a moment" rather than appearing hung.
 */
@Injectable()
export class SandboxQueueService {
  private readonly logger = new Logger(SandboxQueueService.name);
  private readonly maxConcurrent: number;
  private readonly queueTimeoutMs: number;
  private active = 0;
  private waiters: Waiter[] = [];

  constructor() {
    const cap = Number.parseInt(process.env.SANDBOX_MAX_CONCURRENT ?? '', 10);
    this.maxConcurrent = Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_MAX_CONCURRENT;
    const timeout = Number.parseInt(process.env.SANDBOX_QUEUE_TIMEOUT_MS ?? '', 10);
    this.queueTimeoutMs = Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_QUEUE_TIMEOUT_MS;
  }

  /**
   * Wrap a sandbox-running function. Acquires a slot before invoking `fn`
   * and releases on settle. If no slot is free, waits up to queueTimeoutMs
   * before rejecting.
   */
  async withSlot<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /** For tests + the health endpoint. */
  snapshot(): { active: number; waiting: number; maxConcurrent: number } {
    return {
      active: this.active,
      waiting: this.waiters.length,
      maxConcurrent: this.maxConcurrent,
    };
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.timer === timer);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(new SandboxQueueTimeoutError(this.queueTimeoutMs));
      }, this.queueTimeoutMs);
      this.waiters.push({ resolve, reject, timer });
    });
  }

  private release(): void {
    if (this.waiters.length > 0) {
      const next = this.waiters.shift()!;
      clearTimeout(next.timer);
      // Keep `active` constant: one slot transfers from this run to next.
      next.resolve();
      return;
    }
    this.active = Math.max(0, this.active - 1);
  }
}

export class SandboxQueueTimeoutError extends Error {
  readonly code = 'SANDBOX_QUEUE_TIMEOUT';
  constructor(public readonly timeoutMs: number) {
    super(`Sandbox queue timed out after ${timeoutMs}ms`);
    this.name = 'SandboxQueueTimeoutError';
  }
}
