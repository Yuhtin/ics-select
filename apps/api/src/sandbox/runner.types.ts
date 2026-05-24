import type { ChallengeLanguage } from '@ics-select/prisma';

/**
 * Wall-clock execution outcome. Mirrors the strings persisted on
 * SandboxExecutionLog.status so the audit log stays text-grepable without
 * adding a Prisma enum every time we extend.
 */
export type SandboxStatus =
  | 'OK'              // exit 0, finished within timeout
  | 'TIMEOUT'         // killed by wall-clock guard
  | 'COMPILE_ERROR'   // compile step (cpp) failed before run
  | 'RUNTIME_ERROR'   // exit code != 0 (segfault, uncaught exception, etc)
  | 'SANDBOX_ERROR';  // orchestrator failure (docker missing, image not pulled, etc)

export type SandboxRunInput = {
  language: ChallengeLanguage;
  code: string;
  stdin: string;
  /** Hard wall-clock limit, applied via docker stop after expiry. */
  timeoutMs: number;
};

export type SandboxRunResult = {
  status: SandboxStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type TestCase = {
  name: string;
  stdin: string;
  expectedStdout: string;
  hidden?: boolean;
};

export type TestCaseResult =
  | { name: string; hidden: boolean; status: 'PASS'; durationMs: number }
  | { name: string; hidden: boolean; status: 'FAIL'; durationMs: number; stdout: string; expected: string }
  | { name: string; hidden: boolean; status: 'TIMEOUT' | 'RUNTIME_ERROR' | 'COMPILE_ERROR' | 'SANDBOX_ERROR'; durationMs: number; stderr: string };

export type TestRunInput = {
  language: ChallengeLanguage;
  code: string;
  testCases: TestCase[];
};

export type TestRunResult = {
  passed: number;
  total: number;
  cases: TestCaseResult[];
};
