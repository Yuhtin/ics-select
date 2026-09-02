#!/usr/bin/env node
// ICS Select sandbox host service.
//
// Runs on the VPS host (not under EasyPanel). Receives signed HTTP requests
// from the ICS API container and dispatches `docker run` against the host's
// Docker daemon to execute member code inside the hardened sandbox images.
//
// Why a separate service instead of having the API container spawn docker
// directly: the API container doesn't have the docker socket mounted, and
// mounting it would give the API root on the host. This service holds the
// privilege; the API only holds a network token.
//
// Zero npm deps. Single file. Use `node src/server.mjs` to run.

import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import crypto from 'node:crypto';

// ───────────────────────────────────────────────────────────────── config

const PORT = Number.parseInt(process.env.PORT ?? '8787', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const AUTH_TOKEN = process.env.SANDBOX_AUTH_TOKEN ?? '';
const MAX_CONCURRENT = Number.parseInt(process.env.SANDBOX_MAX_CONCURRENT ?? '4', 10);
const QUEUE_TIMEOUT_MS = Number.parseInt(process.env.SANDBOX_QUEUE_TIMEOUT_MS ?? '30000', 10);
const PYTHON_IMAGE = process.env.SANDBOX_PYTHON_IMAGE ?? 'ghcr.io/yuhtin/ics-sandbox-python:stable';
const CPP_IMAGE = process.env.SANDBOX_CPP_IMAGE ?? 'ghcr.io/yuhtin/ics-sandbox-cpp:stable';
const SOURCE_DIR_ROOT = process.env.SANDBOX_TMP_ROOT ?? '/tmp/ics-sandbox';

if (!AUTH_TOKEN || AUTH_TOKEN.length < 16) {
  console.error('SANDBOX_AUTH_TOKEN must be set, ≥16 chars');
  process.exit(1);
}

const STDOUT_CAP_BYTES = 64 * 1024;
const STDERR_CAP_BYTES = 16 * 1024;
const SOURCE_FILE = { PYTHON: 'main.py', CPP: 'main.cpp' };

// ───────────────────────────────────────────────────────────────── queue

let active = 0;
const waiters = [];

function acquire() {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = waiters.findIndex((w) => w.timer === timer);
      if (idx >= 0) waiters.splice(idx, 1);
      reject(new Error('SANDBOX_QUEUE_TIMEOUT'));
    }, QUEUE_TIMEOUT_MS);
    waiters.push({ resolve, reject, timer });
  });
}

function release() {
  if (waiters.length > 0) {
    const next = waiters.shift();
    clearTimeout(next.timer);
    next.resolve();
    return;
  }
  active = Math.max(0, active - 1);
}

// ───────────────────────────────────────────────────────────────── runner

function commandFor(language, hostDir) {
  const baseFlags = [
    'run', '--rm', '-i',
    '--network=none',
    '--memory=256m', '--memory-swap=256m',
    '--cpus=0.5',
    '--pids-limit=64',
    '--read-only',
    '--tmpfs=/tmp:rw,noexec,size=20m',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--user=runner',
    '--ulimit=nofile=64:64',
    '--ulimit=fsize=10485760',
    '-v', `${hostDir}:/code:ro`,
  ];
  if (language === 'PYTHON') {
    return [...baseFlags, PYTHON_IMAGE, 'python3', '/code/main.py'];
  }
  // C++ writes to /tmp because /code is read-only. Compile errors emit on
  // stderr and we exit 124 to mark them distinctly from runtime failures.
  return [
    ...baseFlags, CPP_IMAGE, 'sh', '-c',
    'cp /code/main.cpp /tmp/main.cpp && g++ -O2 -std=c++17 /tmp/main.cpp -o /tmp/main 2>/tmp/build.err && exec /tmp/main; status=$?; [ -s /tmp/build.err ] && { cat /tmp/build.err >&2; exit 124; } || exit $status',
  ];
}

function execDocker(argv, stdin, timeoutMs, startedAt) {
  return new Promise((resolve) => {
    const child = spawn('docker', argv, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let outBytes = 0;
    let errBytes = 0;
    let timedOut = false;

    const killer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      if (outBytes >= STDOUT_CAP_BYTES) return;
      const take = chunk.subarray(0, STDOUT_CAP_BYTES - outBytes);
      stdout += take.toString('utf8');
      outBytes += take.length;
    });
    child.stderr.on('data', (chunk) => {
      if (errBytes >= STDERR_CAP_BYTES) return;
      const take = chunk.subarray(0, STDERR_CAP_BYTES - errBytes);
      stderr += take.toString('utf8');
      errBytes += take.length;
    });
    child.on('error', (err) => {
      clearTimeout(killer);
      resolve({
        status: 'SANDBOX_ERROR',
        exitCode: null,
        stdout,
        stderr: `${stderr}\n${String(err)}`.trim(),
        durationMs: Date.now() - startedAt,
      });
    });
    child.on('close', (code, signal) => {
      clearTimeout(killer);
      const durationMs = Date.now() - startedAt;
      if (timedOut) {
        resolve({ status: 'TIMEOUT', exitCode: null, stdout, stderr, durationMs });
        return;
      }
      if (code === 124) {
        resolve({ status: 'COMPILE_ERROR', exitCode: 124, stdout, stderr, durationMs });
        return;
      }
      if (code !== 0 || signal) {
        resolve({ status: 'RUNTIME_ERROR', exitCode: code, stdout, stderr, durationMs });
        return;
      }
      resolve({ status: 'OK', exitCode: 0, stdout, stderr, durationMs });
    });

    child.stdin.end(stdin);
  });
}

async function runSandbox({ language, code, stdin, timeoutMs }) {
  const startedAt = Date.now();
  const hostDir = await mkdtemp(join(SOURCE_DIR_ROOT, 'run-'));
  try {
    await writeFile(join(hostDir, SOURCE_FILE[language]), code, { mode: 0o644 });
    return await execDocker(commandFor(language, hostDir), stdin, timeoutMs, startedAt);
  } catch (err) {
    return {
      status: 'SANDBOX_ERROR',
      exitCode: null,
      stdout: '',
      stderr: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startedAt,
    };
  } finally {
    rm(hostDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ───────────────────────────────────────────────────────────────── auth

function authOk(req) {
  const got = req.headers['x-sandbox-token'];
  if (typeof got !== 'string') return false;
  if (got.length !== AUTH_TOKEN.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(AUTH_TOKEN));
  } catch {
    return false;
  }
}

// ───────────────────────────────────────────────────────────────── http

const MAX_BODY_BYTES = 100 * 1024;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('payload too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function validateRunInput(input) {
  if (input === null || typeof input !== 'object') throw new Error('body must be object');
  const { language, code, stdin, timeoutMs } = input;
  if (language !== 'PYTHON' && language !== 'CPP') {
    throw new Error('language must be PYTHON or CPP');
  }
  if (typeof code !== 'string' || code.length === 0 || code.length > 32_768) {
    throw new Error('code length must be 1..32768');
  }
  if (typeof stdin !== 'string' || stdin.length > 8_192) {
    throw new Error('stdin length must be 0..8192');
  }
  if (typeof timeoutMs !== 'number' || timeoutMs < 100 || timeoutMs > 10_000) {
    throw new Error('timeoutMs must be 100..10000');
  }
  return { language, code, stdin, timeoutMs };
}

function sendJson(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8');
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': buf.length,
  });
  res.end(buf);
}

const server = http.createServer(async (req, res) => {
  // Health check is unauthenticated so a load balancer or k8s probe can hit it.
  if (req.method === 'GET' && req.url === '/healthz') {
    sendJson(res, 200, {
      ok: true,
      active,
      waiting: waiters.length,
      maxConcurrent: MAX_CONCURRENT,
    });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/run') {
    res.writeHead(404).end();
    return;
  }
  if (!authOk(req)) {
    res.writeHead(401).end();
    return;
  }

  let input;
  try {
    input = validateRunInput(await readJsonBody(req));
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
    return;
  }

  try {
    await acquire();
  } catch (err) {
    sendJson(res, 503, {
      error: err instanceof Error ? err.message : 'queue full',
    });
    return;
  }

  try {
    const result = await runSandbox(input);
    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : 'sandbox failed',
    });
  } finally {
    release();
  }
});

// ───────────────────────────────────────────────────────────────── boot

await mkdir(SOURCE_DIR_ROOT, { recursive: true });

server.listen(PORT, HOST, () => {
  console.log(`sandbox-host-service listening on ${HOST}:${PORT}`);
});

let shuttingDown = false;
function shutdown(sig) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`got ${sig}, draining`);
  server.close(() => process.exit(0));
  // If we have in-flight requests, give them up to 30s to finish.
  setTimeout(() => process.exit(0), 30_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
