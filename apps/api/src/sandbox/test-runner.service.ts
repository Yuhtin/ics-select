import { Injectable, Logger } from '@nestjs/common';
import { SandboxService } from './sandbox.service.js';
import type {
  TestCase,
  TestCaseResult,
  TestRunInput,
  TestRunResult,
} from './runner.types.js';

const PER_CASE_TIMEOUT_MS = 5_000;

/**
 * Runs a batch of test cases against a single code submission. Each case is
 * an independent sandbox execution (a fresh container) — we never share
 * state between cases.
 *
 * Cases run SERIALLY for the same submission. The concurrency cap lives on
 * the host service (one global semaphore across all submissions). Serial
 * iteration here means a single member submitting 10 cases doesn't burst
 * 10 requests at the host at once — fairness without an API-side queue.
 */
@Injectable()
export class TestRunnerService {
  private readonly logger = new Logger(TestRunnerService.name);

  constructor(private readonly sandbox: SandboxService) {}

  async run(
    input: TestRunInput,
    audit: { userId?: string; attemptId?: string } = {},
  ): Promise<TestRunResult> {
    if (input.testCases.length === 0) {
      return { passed: 0, total: 0, cases: [] };
    }

    const cases: TestCaseResult[] = [];
    for (const tc of input.testCases) {
      const result = await this.sandbox.run(
        {
          language: input.language,
          code: input.code,
          stdin: tc.stdin,
          timeoutMs: PER_CASE_TIMEOUT_MS,
        },
        audit,
      );
      cases.push(asTestResult(tc, result));
    }

    const passed = cases.filter((c) => c.status === 'PASS').length;
    return { passed, total: cases.length, cases };
  }
}

function asTestResult(tc: TestCase, run: { status: string; stdout: string; stderr: string; durationMs: number }): TestCaseResult {
  const hidden = tc.hidden ?? false;
  if (run.status === 'TIMEOUT' || run.status === 'COMPILE_ERROR' || run.status === 'RUNTIME_ERROR' || run.status === 'SANDBOX_ERROR') {
    return {
      name: tc.name,
      hidden,
      status: run.status,
      durationMs: run.durationMs,
      stderr: truncate(run.stderr, 4_000),
    };
  }
  const normalizedOut = normalize(run.stdout);
  const normalizedExp = normalize(tc.expectedStdout);
  if (normalizedOut === normalizedExp) {
    return { name: tc.name, hidden, status: 'PASS', durationMs: run.durationMs };
  }
  return {
    name: tc.name,
    hidden,
    status: 'FAIL',
    durationMs: run.durationMs,
    stdout: truncate(run.stdout, 4_000),
    expected: truncate(tc.expectedStdout, 4_000),
  };
}

/**
 * Trim and collapse line endings before comparison. Real test cases often
 * have a trailing newline in `expectedStdout` while user code may or may
 * not print one. Normalizing both sides removes that footgun.
 */
function normalize(s: string): string {
  return s.replace(/\r\n/g, '\n').trimEnd();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '\n... [truncated]';
}
