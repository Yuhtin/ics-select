# Sandbox setup (VPS, one-time)

This document covers the **host-side install** required to enable
Challenge Mode in production. The application side (API + frontend)
already ships in the main repo; this file is purely ops.

## Architecture summary

The API container does NOT spawn `docker run` directly. Mounting the
docker socket into the API would mean root on the host, and the host
runs multiple unrelated projects (EasyPanel, brinv, cs2, …). So we
isolate the privilege:

```
┌─ EasyPanel (Swarm, untouched by this setup) ─┐
│  ics-backend (API container)                 │
│      │ POST /run  (X-Sandbox-Token)          │
└──────┼───────────────────────────────────────┘
       ▼
┌─ Host (NOT managed by EasyPanel) ────────────┐
│  ics-sandbox-host  (systemd → docker run)    │
│      │ docker run --network=none …           │
│      ▼                                       │
│  ghcr.io/yuhtin/ics-sandbox-{python,cpp}     │
│      one ephemeral container per execution   │
└──────────────────────────────────────────────┘
```

Three pieces to install on the VPS:

1. The **sandbox-host-service** container itself (managed by `systemd`,
   not by EasyPanel).
2. The **weekly refresh cron** that pulls fresh sandbox images.
3. One **environment variable** added to the ICS API service inside
   EasyPanel — `SANDBOX_AUTH_TOKEN` matching what the host service
   knows.

No changes to `/etc/docker/daemon.json`. No daemon restart. The other
EasyPanel containers (Postgres, Mongo, Traefik, brinv, cs2, …) are
not touched.

---

## 1. Generate the shared auth token

```bash
openssl rand -hex 32
```

Save the output. It goes in two places:

- **EasyPanel ICS API service env**: `SANDBOX_AUTH_TOKEN=<that hex>`
- **Host environment file** (next step): `SANDBOX_AUTH_TOKEN=<that hex>`

The token never leaves the host: the API container talks to the
service over `127.0.0.1:8787` (loopback), so no TLS is needed.

## 2. Install the host environment file

`scp` or paste this into `/etc/ics-sandbox-host.env` (mode 0600, owned
by root):

```bash
sudo install -o root -g root -m 0600 /dev/stdin /etc/ics-sandbox-host.env <<'EOF'
SANDBOX_AUTH_TOKEN=<paste the openssl output>
SANDBOX_MAX_CONCURRENT=4
SANDBOX_QUEUE_TIMEOUT_MS=30000
SANDBOX_PYTHON_IMAGE=ghcr.io/yuhtin/ics-sandbox-python:stable
SANDBOX_CPP_IMAGE=ghcr.io/yuhtin/ics-sandbox-cpp:stable
EOF
```

Why 0600: the file holds a credential. `systemctl cat` won't expose it
because the unit references it via `EnvironmentFile=`.

## 3. Install the systemd unit

```bash
sudo cp infra/sandbox-host-service/systemd/ics-sandbox-host.service \
        /etc/systemd/system/ics-sandbox-host.service
sudo systemctl daemon-reload
```

Verify with `systemctl cat ics-sandbox-host` that the file landed.

## 4. Pre-pull the three images

`docker pull` ahead of the first start so the systemd unit doesn't pay
the cold-pull cost (the API call would time out otherwise):

```bash
sudo docker pull ghcr.io/yuhtin/ics-sandbox-host:stable
sudo docker pull ghcr.io/yuhtin/ics-sandbox-python:stable
sudo docker pull ghcr.io/yuhtin/ics-sandbox-cpp:stable
```

If `docker pull` errors with "denied", the images are still private —
either make them public on the GitHub Packages settings page or
configure docker for ghcr auth on the host.

## 5. Prepare the shared tmp dir

```bash
sudo mkdir -p /tmp/ics-sandbox
sudo chmod 1777 /tmp/ics-sandbox   # sticky like /tmp
```

This directory holds the per-execution source files. The host service
container mounts it from the host AND each sandbox container mounts a
subdirectory of it read-only.

## 6. Start the service

```bash
sudo systemctl enable --now ics-sandbox-host
sudo systemctl status ics-sandbox-host
```

Expected: `Active: active (running)`. If it fails, check the logs:

```bash
sudo journalctl -u ics-sandbox-host -n 50 --no-pager
```

## 7. Smoke test

From the host, hit `/healthz`:

```bash
curl -fsS http://127.0.0.1:8787/healthz
# {"ok":true,"active":0,"waiting":0,"maxConcurrent":4}
```

Then exercise `/run` with the token:

```bash
TOKEN=$(grep SANDBOX_AUTH_TOKEN /etc/ics-sandbox-host.env | cut -d= -f2)
curl -fsS -X POST http://127.0.0.1:8787/run \
  -H "content-type: application/json" \
  -H "x-sandbox-token: $TOKEN" \
  -d '{"language":"PYTHON","code":"print(input())","stdin":"hello\n","timeoutMs":5000}'
# {"status":"OK","exitCode":0,"stdout":"hello\n","stderr":"","durationMs":...}
```

If `stderr` is empty and `status: OK`, the entire pipe works:
service → host docker → sandbox container → reply.

## 8. Wire EasyPanel

In the ICS API service settings on EasyPanel, add the env var:

```
SANDBOX_AUTH_TOKEN=<same hex from step 1>
SANDBOX_HOST_URL=http://host.docker.internal:8787
```

Save and redeploy the ICS API service. The deploy is a normal rolling
update — no downtime for the other services.

## 9. Install the refresh cron

`refresh.sh` keeps the sandbox images current week to week (sandbox
images, not the host service itself — the host service auto-updates
via systemd when you `docker pull` and restart the unit; the GHA
already publishes new tags weekly):

```bash
sudo mkdir -p /opt/ics-sandbox
sudo cp infra/sandbox/refresh.sh /opt/ics-sandbox/refresh.sh
sudo chmod +x /opt/ics-sandbox/refresh.sh

sudo crontab -e
#  0 7 * * 0 /opt/ics-sandbox/refresh.sh >> /var/log/ics-sandbox-refresh.log 2>&1
```

To also refresh the host service container weekly, add a second line:

```
30 7 * * 0 /usr/bin/docker pull ghcr.io/yuhtin/ics-sandbox-host:stable \
            && /usr/bin/systemctl restart ics-sandbox-host \
            >> /var/log/ics-sandbox-host-refresh.log 2>&1
```

## 10. Monitoring (post-deploy)

Watch these for the first week of use:

| Metric | Where | What to look for |
|---|---|---|
| Active executions | `curl 127.0.0.1:8787/healthz \| jq` | `active` should rarely sit at `maxConcurrent` |
| Service logs | `journalctl -u ics-sandbox-host -f` | sandbox/auth errors |
| Per-execution audit | Postgres `SandboxExecutionLog` | status distribution, durationMs P95 |
| Host load | `uptime` | 5m load over core count → drop `SANDBOX_MAX_CONCURRENT` |
| Disk on /var/lib/docker | `df -h` | grows fast → `docker image prune -f` |
| `/tmp/ics-sandbox` | `du -sh /tmp/ics-sandbox` | should stay near zero — leaked dirs mean a bug |

## Rollback

To stop accepting new challenges (without redeploying the API):

```bash
sudo systemctl stop ics-sandbox-host
```

The API returns SANDBOX_ERROR for all sandbox calls; the rest of the
product keeps working. Restart with `systemctl start ics-sandbox-host`.

To pin a specific previous image tag during an incident:

```bash
sudo docker pull ghcr.io/yuhtin/ics-sandbox-host:stable-20260520
sudo docker tag ghcr.io/yuhtin/ics-sandbox-host:stable-20260520 \
                ghcr.io/yuhtin/ics-sandbox-host:stable
sudo systemctl restart ics-sandbox-host
# Disable the cron line that re-pulls :stable until upstream is fixed.
```

## Threat model notes

The hardening flags on every sandbox container (set by the host
service in `commandFor()` at `infra/sandbox-host-service/src/server.mjs`):

```
--network=none           no DNS, no egress, no metadata service
--memory=256m            no OOM-the-host
--cpus=0.5               no CPU monopolization
--pids-limit=64          fork bombs cap out
--read-only              rootfs is immutable
--tmpfs=/tmp:rw,noexec   /tmp writable but never executable
--cap-drop=ALL           no Linux capabilities
--security-opt=no-new-privileges   no setuid escalation
--user=runner            UID 10001 inside, not root
--ulimit=fsize=10MB      can't fill the disk
```

What we don't have (and the trade-off):

- **No `userns-remap` on the daemon.** Enabling it would break volume
  access for all the unrelated projects sharing this VPS. We accept the
  remaining risk because the cohort is trusted (~12 vetted members) and
  the per-container hardening above blocks the realistic attacks. When
  the platform moves to a dedicated VPS, revisit.
- **The host service container runs as root.** It needs the docker
  socket. The blast radius is the host service itself — not the API
  container (which has the secrets), not the EasyPanel services.
