# sandbox-host-service

Standalone HTTP service that runs on the VPS host, listens on
`127.0.0.1:8787`, and dispatches `docker run` against the host daemon
to execute member code submitted by the ICS API. Built so the API
container itself never holds the docker socket.

Single zero-dep `.mjs` file (`src/server.mjs`). Runs in a Docker image
that bundles Node 24 + the docker CLI.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/healthz` | none | snapshot `{active, waiting, maxConcurrent}` |
| POST | `/run` | `X-Sandbox-Token` | one sandbox execution |

`POST /run` body:

```json
{
  "language": "PYTHON" | "CPP",
  "code": "string, 1..32768 chars",
  "stdin": "string, 0..8192 chars",
  "timeoutMs": 100..10000
}
```

Response (`200 OK`):

```json
{
  "status": "OK" | "TIMEOUT" | "COMPILE_ERROR" | "RUNTIME_ERROR" | "SANDBOX_ERROR",
  "exitCode": int | null,
  "stdout": "string (capped 64KB)",
  "stderr": "string (capped 16KB)",
  "durationMs": int
}
```

`503` is returned when the concurrency cap (`SANDBOX_MAX_CONCURRENT`,
default 4) has been hit and the queue wait timeout
(`SANDBOX_QUEUE_TIMEOUT_MS`, default 30s) expired.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | bind port |
| `HOST` | `0.0.0.0` | bind interface (publish on `127.0.0.1` from the host) |
| `SANDBOX_AUTH_TOKEN` | (required, ≥16 chars) | shared with API |
| `SANDBOX_MAX_CONCURRENT` | `4` | semaphore cap on parallel containers |
| `SANDBOX_QUEUE_TIMEOUT_MS` | `30000` | reject 503 after this wait |
| `SANDBOX_PYTHON_IMAGE` | `ghcr.io/yuhtin/ics-sandbox-python:stable` | image for PYTHON |
| `SANDBOX_CPP_IMAGE` | `ghcr.io/yuhtin/ics-sandbox-cpp:stable` | image for CPP |
| `SANDBOX_TMP_ROOT` | `/tmp/ics-sandbox` | source dir staging (must be a bind mount from host) |

## Install on the VPS

See `docs/sandbox-setup.md` at the repo root for the full step-by-step.
Short version:

1. `openssl rand -hex 32` → save the token
2. write `/etc/ics-sandbox-host.env` (mode 0600) with the token + tunables
3. `cp systemd/ics-sandbox-host.service /etc/systemd/system/`
4. `docker pull ghcr.io/yuhtin/ics-sandbox-host:stable` (and the two language images)
5. `mkdir -p /tmp/ics-sandbox && chmod 1777 /tmp/ics-sandbox`
6. `systemctl daemon-reload && systemctl enable --now ics-sandbox-host`
7. `curl 127.0.0.1:8787/healthz`

## Local development

```bash
SANDBOX_AUTH_TOKEN=$(openssl rand -hex 32) \
SANDBOX_TMP_ROOT=/tmp/ics-sandbox-dev \
node src/server.mjs
```

Needs the docker CLI on `$PATH` and `/var/run/docker.sock` accessible.
Also pull the two sandbox images locally first:

```bash
docker pull ghcr.io/yuhtin/ics-sandbox-python:stable
docker pull ghcr.io/yuhtin/ics-sandbox-cpp:stable
```

## Threat model

The service runs as root because it needs the docker socket. The
realistic blast radius if it gets compromised is the host —
**not** the API container or EasyPanel services. Per-execution
sandbox containers carry the hardening flags
(`--network=none --cap-drop=ALL --read-only --pids-limit --user=runner`,
etc) so even a malicious member code can't reach the host.

We deliberately do not enable `userns-remap` on the docker daemon
because this VPS hosts multiple unrelated projects. See
`docs/sandbox-setup.md` for the full rationale.
