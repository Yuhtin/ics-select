import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type {
  SandboxRunInput,
  SandboxRunResult,
  SandboxStatus,
} from './runner.types.js';

const DEFAULT_TIMEOUT_MS = 5_000;
const HTTP_TIMEOUT_MS = 15_000;

/**
 * Thin HTTP client for the sandbox-host-service. We don't spawn docker
 * locally because the API container doesn't have the daemon socket and
 * giving it one would mean root on the host. The host service holds the
 * privilege; we hold a shared-secret token.
 *
 * Failure modes the caller sees as SandboxStatus:
 *   OK / TIMEOUT / COMPILE_ERROR / RUNTIME_ERROR — passed through from the host
 *   SANDBOX_ERROR — host unreachable, 5xx, auth, validation, etc
 *
 * Every call still produces a SandboxExecutionLog row for audit. The host
 * service has its own per-process logs but Postgres is the source of truth
 * for cross-service queries (capacity planning, abuse detection).
 */
@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);
  private readonly hostUrl: string;
  private readonly authToken: string;

  constructor(private readonly prisma: PrismaService) {
    this.hostUrl = (process.env.SANDBOX_HOST_URL ?? 'http://host.docker.internal:8787').replace(/\/+$/, '');
    this.authToken = process.env.SANDBOX_AUTH_TOKEN ?? '';
    if (!this.authToken) {
      this.logger.warn(
        'SANDBOX_AUTH_TOKEN is empty — sandbox calls will fail until it is set.',
      );
    }
  }

  /**
   * Execute member code once. Mirrors the previous local-spawn contract so
   * callers (TestRunnerService, ChallengesService) don't have to change.
   */
  async run(
    input: SandboxRunInput,
    audit: { userId?: string; attemptId?: string } = {},
  ): Promise<SandboxRunResult> {
    const startedAt = Date.now();
    const timeoutMs = input.timeoutMs > 0 ? input.timeoutMs : DEFAULT_TIMEOUT_MS;
    const result = await this.callHost({ ...input, timeoutMs }, startedAt);

    // Audit log is fire-and-forget. Failing to write it never blocks.
    this.logExecution({ ...input, timeoutMs }, result, audit).catch((err) => {
      this.logger.warn(`sandbox execution log failed: ${String(err)}`);
    });
    return result;
  }

  /**
   * Compatibility shim. The pre-refactor SandboxService had a queued variant
   * because the queue lived on the API side. The host service now owns the
   * concurrency cap so this is just an alias for `run` — kept so existing
   * callers (ChallengesService) don't need a code change.
   */
  runQueued(
    input: SandboxRunInput,
    audit?: { userId?: string; attemptId?: string },
  ): Promise<SandboxRunResult> {
    return this.run(input, audit);
  }

  private async callHost(
    input: SandboxRunInput,
    startedAt: number,
  ): Promise<SandboxRunResult> {
    const controller = new AbortController();
    const abort = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.hostUrl}/run`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-sandbox-token': this.authToken,
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (response.status === 503) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        return sandboxError(
          body.error ?? 'sandbox queue full',
          startedAt,
        );
      }
      if (response.status === 401) {
        return sandboxError('sandbox auth rejected (bad SANDBOX_AUTH_TOKEN)', startedAt);
      }
      if (!response.ok) {
        const body = (await response.text().catch(() => '')).slice(0, 500);
        return sandboxError(`sandbox host returned ${response.status}: ${body}`, startedAt);
      }

      const data = (await response.json()) as SandboxRunResult;
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return sandboxError(`sandbox host unreachable: ${message}`, startedAt);
    } finally {
      clearTimeout(abort);
    }
  }

  private async logExecution(
    input: SandboxRunInput,
    result: SandboxRunResult,
    audit: { userId?: string; attemptId?: string },
  ): Promise<void> {
    await this.prisma.sandboxExecutionLog.create({
      data: {
        userId: audit.userId ?? null,
        attemptId: audit.attemptId ?? null,
        language: input.language,
        status: result.status,
        exitCode: result.exitCode ?? null,
        durationMs: result.durationMs,
        stdoutBytes: Buffer.byteLength(result.stdout, 'utf8'),
        stderrBytes: Buffer.byteLength(result.stderr, 'utf8'),
        codeBytes: Buffer.byteLength(input.code, 'utf8'),
        stdinBytes: Buffer.byteLength(input.stdin, 'utf8'),
      },
    });
  }
}

function sandboxError(message: string, startedAt: number): SandboxRunResult {
  return {
    status: 'SANDBOX_ERROR',
    exitCode: null,
    stdout: '',
    stderr: message,
    durationMs: Date.now() - startedAt,
  };
}

const sandboxStatusValues: SandboxStatus[] = ['OK', 'TIMEOUT', 'COMPILE_ERROR', 'RUNTIME_ERROR', 'SANDBOX_ERROR'];
export function isSandboxStatus(s: string): s is SandboxStatus {
  return sandboxStatusValues.includes(s as SandboxStatus);
}
