import { TestRunnerService } from './test-runner.service';
import type { SandboxRunResult } from './runner.types';

function makeSandbox(scripted: SandboxRunResult[]) {
  let i = 0;
  return {
    run: jest.fn(async () => {
      const r = scripted[i] ?? scripted[scripted.length - 1];
      i += 1;
      return r;
    }),
  };
}

describe('TestRunnerService', () => {

  it('returns zero counts on empty test cases', async () => {
    const sandbox = makeSandbox([]);
    const svc = new TestRunnerService(sandbox as any);
    const out = await svc.run({ language: 'PYTHON', code: 'x', testCases: [] });
    expect(out).toEqual({ passed: 0, total: 0, cases: [] });
    expect(sandbox.run).not.toHaveBeenCalled();
  });

  it('passes when stdout matches expected (normalized)', async () => {
    const sandbox = makeSandbox([
      { status: 'OK', exitCode: 0, stdout: 'hello\n', stderr: '', durationMs: 12 },
    ]);
    const svc = new TestRunnerService(sandbox as any);
    const out = await svc.run({
      language: 'PYTHON',
      code: 'print("hello")',
      testCases: [{ name: 'simple', stdin: '', expectedStdout: 'hello' }],
    });
    expect(out.passed).toBe(1);
    expect(out.total).toBe(1);
    expect(out.cases[0]!.status).toBe('PASS');
  });

  it('fails when stdout differs and exposes captured output', async () => {
    const sandbox = makeSandbox([
      { status: 'OK', exitCode: 0, stdout: 'world', stderr: '', durationMs: 5 },
    ]);
    const svc = new TestRunnerService(sandbox as any);
    const out = await svc.run({
      language: 'PYTHON',
      code: 'print("world")',
      testCases: [{ name: 'simple', stdin: '', expectedStdout: 'hello' }],
    });
    expect(out.passed).toBe(0);
    expect(out.cases[0]!.status).toBe('FAIL');
    expect(out.cases[0]).toMatchObject({ stdout: 'world', expected: 'hello' });
  });

  it('propagates TIMEOUT / COMPILE_ERROR / RUNTIME_ERROR per case', async () => {
    const sandbox = makeSandbox([
      { status: 'TIMEOUT', exitCode: null, stdout: '', stderr: '', durationMs: 5000 },
      { status: 'COMPILE_ERROR', exitCode: 124, stdout: '', stderr: 'syntax error', durationMs: 80 },
      { status: 'RUNTIME_ERROR', exitCode: 1, stdout: 'partial', stderr: 'segv', durationMs: 22 },
    ]);
    const svc = new TestRunnerService(sandbox as any);
    const out = await svc.run({
      language: 'CPP',
      code: 'broken',
      testCases: [
        { name: 't1', stdin: '', expectedStdout: 'x' },
        { name: 't2', stdin: '', expectedStdout: 'x' },
        { name: 't3', stdin: '', expectedStdout: 'x' },
      ],
    });
    expect(out.passed).toBe(0);
    expect(out.cases.map((c) => c.status)).toEqual([
      'TIMEOUT',
      'COMPILE_ERROR',
      'RUNTIME_ERROR',
    ]);
  });

  it('preserves the hidden flag from the test case', async () => {
    const sandbox = makeSandbox([
      { status: 'OK', exitCode: 0, stdout: '42', stderr: '', durationMs: 1 },
    ]);
    const svc = new TestRunnerService(sandbox as any);
    const out = await svc.run({
      language: 'PYTHON',
      code: 'print(42)',
      testCases: [{ name: 'secret', stdin: '', expectedStdout: '42', hidden: true }],
    });
    expect(out.cases[0]!.hidden).toBe(true);
  });

  it('normalizes \\r\\n endings before comparison', async () => {
    const sandbox = makeSandbox([
      { status: 'OK', exitCode: 0, stdout: 'a\r\nb\r\n', stderr: '', durationMs: 3 },
    ]);
    const svc = new TestRunnerService(sandbox as any);
    const out = await svc.run({
      language: 'PYTHON',
      code: '',
      testCases: [{ name: 'crlf', stdin: '', expectedStdout: 'a\nb' }],
    });
    expect(out.passed).toBe(1);
  });
});
