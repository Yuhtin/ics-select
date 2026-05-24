import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { SOURCE_FILE_NAME } from './templates.js';
import type {
  SandboxRunInput,
  SandboxRunResult,
  SandboxStatus,
} from './runner.types.js';
import { SandboxQueueService } from './queue.service.js';
import type { ChallengeLanguage } from '@ics-select/prisma';

const STDOUT_CAP_BYTES = 64 * 1024;
const STDERR_CAP_BYTES = 16 * 1024;
const DEFAULT_TIMEOUT_MS = 5_000;
// Container has /tmp tmpfs at 20MB. We allocate the host source dir for the
// read-only mount; the binary the C++ build emits lives in /tmp/main inside.
const HOST_TMP_PREFIX = 'ics-sandbox-';

type RunCommand = {
  /** Argv after `docker run <flags> <image>`. */
  argv: string[];
};

/**
 * Orchestrates a single sandbox execution: writes the source to a host tmp
 * dir, mounts it read-only into a hardened container, pipes stdin in,
 * captures stdout/stderr (capped), and applies a wall-clock timeout.
 *
 * Does NOT enforce concurrency — wrap calls in SandboxQueueService.withSlot
 * for that. Decoupled so individual unit tests can exercise the runner
 * without going through the queue.
 *
 * Persists one SandboxExecutionLog row per invocation for audit + capacity
 * analysis. The log is fire-and-forget; failing to write it doesn't block
 * returning the result.
 */
@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);
  private readonly pythonImage: string;
  private readonly cppImage: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: SandboxQueueService,
  ) {
    this.pythonImage = process.env.SANDBOX_PYTHON_IMAGE ?? 'ghcr.io/yuhtin/ics-sandbox-python:stable';
    this.cppImage = process.env.SANDBOX_CPP_IMAGE ?? 'ghcr.io/yuhtin/ics-sandbox-cpp:stable';
  }

  /** Convenience wrapper that goes through the queue. */
  runQueued(
    input: SandboxRunInput,
    audit?: { userId?: string; attemptId?: string },
  ): Promise<SandboxRunResult> {
    return this.queue.withSlot(() => this.run(input, audit));
  }

  /**
   * Execute once. Caller is responsible for queue acquisition.
   *
   * Steps:
   *   1. Materialize source under /tmp/ics-sandbox-XXXX/{main.py|main.cpp}.
   *   2. docker run with hardening flags, stdin piped, stdout/stderr captured.
   *   3. Kill on wall-clock timeout via container stop (faster than docker kill).
   *   4. Map exit code to SandboxStatus.
   *   5. Log to SandboxExecutionLog (fire-and-forget).
   *   6. Clean up host tmp dir.
   */
  async run(
    input: SandboxRunInput,
    audit: { userId?: string; attemptId?: string } = {},
  ): Promise<SandboxRunResult> {
    const startedAt = Date.now();
    const timeoutMs = input.timeoutMs > 0 ? input.timeoutMs : DEFAULT_TIMEOUT_MS;
    const hostDir = await mkdtemp(join(tmpdir(), HOST_TMP_PREFIX));
    const fileName = SOURCE_FILE_NAME[input.language];

    let result: SandboxRunResult;
    try {
      await writeFile(join(hostDir, fileName), input.code, { mode: 0o644 });
      const cmd = this.commandFor(input.language, hostDir);
      result = await this.execDocker(cmd, input.stdin, timeoutMs);
    } catch (err) {
      this.logger.warn(`sandbox.run failed pre-exec: ${String(err)}`);
      result = {
        status: 'SANDBOX_ERROR',
        exitCode: null,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
      };
    } finally {
      // Best-effort cleanup. Leaving a stray tmp dir is annoying but not
      // fatal — the OS will eventually clean /tmp.
      rm(hostDir, { recursive: true, force: true }).catch(() => undefined);
    }

    // Audit log is fire-and-forget. Don't await; don't block the caller.
    this.logExecution(input, result, audit).catch((err) => {
      this.logger.warn(`sandbox execution log failed: ${String(err)}`);
    });

    return result;
  }

  /** Build the `docker run` argv for a given language + host source dir. */
  private commandFor(language: ChallengeLanguage, hostDir: string): RunCommand {
    const baseFlags = [
      'run',
      '--rm',
      '-i',
      '--network=none',
      '--memory=256m',
      '--memory-swap=256m',
      '--cpus=0.5',
      '--pids-limit=64',
      '--read-only',
      '--tmpfs=/tmp:rw,noexec,size=20m',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--user=runner',
      '--ulimit=nofile=64:64',
      '--ulimit=fsize=10485760',
      '-v',
      `${hostDir}:/code:ro`,
    ];

    if (language === 'PYTHON') {
      return {
        argv: [...baseFlags, this.pythonImage, 'python3', '/code/main.py'],
      };
    }
    // C++: copy to /tmp first because /code is read-only (clang can't write
    // the binary alongside the source). The `&& exec` chain runs the binary
    // in-place so exit code propagates.
    return {
      argv: [
        ...baseFlags,
        this.cppImage,
        'sh',
        '-c',
        'cp /code/main.cpp /tmp/main.cpp && g++ -O2 -std=c++17 /tmp/main.cpp -o /tmp/main 2>/tmp/build.err && exec /tmp/main; status=$?; [ -s /tmp/build.err ] && { cat /tmp/build.err >&2; exit 124; } || exit $status',
      ],
    };
  }

  /**
   * Spawn docker, pipe stdin in, collect output capped at STDOUT/STDERR cap.
   * Hard-kill the container if wall-clock exceeds timeoutMs.
   */
  private execDocker(cmd: RunCommand, stdin: string, timeoutMs: number): Promise<SandboxRunResult> {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const child = spawn('docker', cmd.argv, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let timedOut = false;

      const killTimer = setTimeout(() => {
        timedOut = true;
        // SIGKILL the docker CLI; the container goes with it because the
        // `-i` flag attaches stdio. docker's cleanup handler removes the
        // container thanks to `--rm`.
        child.kill('SIGKILL');
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        if (stdoutBytes >= STDOUT_CAP_BYTES) return;
        const take = chunk.subarray(0, STDOUT_CAP_BYTES - stdoutBytes);
        stdout += take.toString('utf8');
        stdoutBytes += take.length;
      });
      child.stderr.on('data', (chunk: Buffer) => {
        if (stderrBytes >= STDERR_CAP_BYTES) return;
        const take = chunk.subarray(0, STDERR_CAP_BYTES - stderrBytes);
        stderr += take.toString('utf8');
        stderrBytes += take.length;
      });
      child.on('error', (err) => {
        clearTimeout(killTimer);
        resolve({
          status: 'SANDBOX_ERROR',
          exitCode: null,
          stdout,
          stderr: stderr + '\n' + String(err),
          durationMs: Date.now() - startedAt,
        });
      });
      child.on('close', (code, signal) => {
        clearTimeout(killTimer);
        const durationMs = Date.now() - startedAt;
        if (timedOut) {
          resolve({ status: 'TIMEOUT', exitCode: null, stdout, stderr, durationMs });
          return;
        }
        // Exit 124 is the sentinel the C++ shell-wrapper uses for "compile
        // failed". Anything non-zero else is runtime error.
        if (code === 124) {
          resolve({ status: 'COMPILE_ERROR', exitCode: 124, stdout, stderr, durationMs });
          return;
        }
        if (code !== 0 || signal) {
          resolve({
            status: 'RUNTIME_ERROR',
            exitCode: code,
            stdout,
            stderr,
            durationMs,
          });
          return;
        }
        resolve({ status: 'OK', exitCode: 0, stdout, stderr, durationMs });
      });

      // Pipe stdin in one go. Member stdin is capped at 8KB upstream.
      child.stdin.end(stdin);
    });
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

const sandboxStatusValues: SandboxStatus[] = ['OK', 'TIMEOUT', 'COMPILE_ERROR', 'RUNTIME_ERROR', 'SANDBOX_ERROR'];
export function isSandboxStatus(s: string): s is SandboxStatus {
  return sandboxStatusValues.includes(s as SandboxStatus);
}
