# Sandbox setup (VPS, one-time)

This document covers the **one-time host configuration** the VPS needs
before Challenge Mode can run member code in containers. Everything here
is operations work, not application code. The application side
(`apps/api/src/sandbox/`) ships in a later PR.

The CI/CD side (image build + Trivy scan + push) is fully automated by
`.github/workflows/sandbox-images.yml` plus Dependabot. The VPS only
needs (1) a Docker daemon configured with `userns-remap` enabled, and
(2) a weekly cron that pulls the latest stable images.

## 1. Enable `userns-remap` on the Docker daemon

`userns-remap` maps the in-container root (UID 0) to an unprivileged
subuid on the host. Even if a process inside the sandbox escalates to
root (e.g. via a future Docker escape CVE), on the host it's just a
high-UID nobody — no access to `/etc`, no kill on other containers, no
read of /var/lib/docker.

This is the **single most important defense** in the stack. Without it,
all the other flags (`--cap-drop=ALL`, `--read-only`, etc) buy you less.

**Steps:**

1. Pick a remap user. Add it on the host:

   ```bash
   sudo useradd --system --no-create-home --shell /sbin/nologin dockremap
   sudo grep dockremap /etc/subuid /etc/subgid
   # Should print something like:
   #   /etc/subuid:dockremap:524288:65536
   #   /etc/subgid:dockremap:524288:65536
   # If not, run:
   #   echo 'dockremap:524288:65536' | sudo tee -a /etc/subuid
   #   echo 'dockremap:524288:65536' | sudo tee -a /etc/subgid
   ```

2. Edit `/etc/docker/daemon.json` (create if absent):

   ```json
   {
     "userns-remap": "dockremap",
     "live-restore": true,
     "default-ulimits": {
       "nofile": { "Name": "nofile", "Hard": 1024, "Soft": 1024 }
     }
   }
   ```

   `live-restore: true` lets running containers survive the daemon
   restart that comes next.

3. Restart the daemon:

   ```bash
   sudo systemctl restart docker
   ```

4. **Verify**. This is the critical confirmation step:

   ```bash
   docker run --rm alpine id
   # Expected: uid=0(root) gid=0(root) ...
   docker run --rm alpine sh -c 'cat /proc/self/uid_map'
   # Expected: 0 524288 65536   ← in-container UID 0 → host UID 524288
   ```

   If `uid_map` shows `0 0 ...`, the remap did NOT take effect — do not
   proceed.

**Important side effect:** every container started after the remap lives
under `/var/lib/docker/524288.524288/` instead of `/var/lib/docker/`.
Volumes that existed before the remap won't be visible to remapped
containers. Since the API + EasyPanel containers use named volumes and
were started after we'd enable the remap, this is fine, but verify
EasyPanel comes back healthy before declaring victory.

## 2. Install the weekly pull cron

```bash
sudo mkdir -p /opt/ics-sandbox
sudo cp infra/sandbox/refresh.sh /opt/ics-sandbox/refresh.sh
sudo chmod +x /opt/ics-sandbox/refresh.sh

# Add to root crontab (refresh.sh needs docker socket access).
sudo crontab -e
# Append:
#   0 7 * * 0 /opt/ics-sandbox/refresh.sh >> /var/log/ics-sandbox-refresh.log 2>&1
```

First run, kick it off manually to seed the images so the first member
challenge attempt doesn't pay the cold-pull cost:

```bash
sudo /opt/ics-sandbox/refresh.sh
```

`docker images | grep ics-sandbox` should now list both images.

## 3. Smoke test

Once the images are present, confirm the hardening flags compile cleanly:

```bash
# Python smoke
echo 'print("hello", input())' | docker run --rm -i \
  --network=none --memory=256m --memory-swap=256m --cpus=0.5 \
  --pids-limit=64 --read-only --tmpfs=/tmp:rw,noexec,size=20m \
  --cap-drop=ALL --security-opt=no-new-privileges \
  --user=runner \
  -v /dev/null:/code/main.py:ro \
  ghcr.io/yuhtin/ics-sandbox-python:stable \
  sh -c 'echo "world" | python3 -c "print(input())"'
# Expected: world
```

```bash
# C++ smoke (compile + run + stdin echo)
docker run --rm -i \
  --network=none --memory=256m --memory-swap=256m --cpus=0.5 \
  --pids-limit=64 --read-only --tmpfs=/tmp:rw,noexec,size=20m \
  --cap-drop=ALL --security-opt=no-new-privileges \
  --user=runner \
  ghcr.io/yuhtin/ics-sandbox-cpp:stable \
  sh -c 'cat > /tmp/main.cpp <<EOF
#include <iostream>
int main() { std::string s; std::cin >> s; std::cout << s << std::endl; return 0; }
EOF
g++ -O2 -std=c++17 /tmp/main.cpp -o /tmp/main && echo "world" | /tmp/main'
# Expected: world
```

## 4. Monitoring (post-deploy)

Before the feature ramps to all members, watch these on the VPS for the
first week:

| Metric | Where | What to look for |
|---|---|---|
| Container count | `docker ps --no-trunc \| wc -l` | Spikes above ~6 mean the API semaphore is failing or being bypassed |
| RAM headroom | `free -m` | `available` should stay > 1GB during peak |
| Load avg | `uptime` | 5m load > number of cores → CPU starvation, lower semaphore cap |
| Disk on /var/lib/docker | `df -h` | If growing fast, images aren't being pruned by `refresh.sh` |
| Refresh cron log | `/var/log/ics-sandbox-refresh.log` | Errors → ghcr auth issue or network |

If load average spikes, lower `SANDBOX_MAX_CONCURRENT` (env var read by
the API) from 4 to 2 and observe again. No code change required.

## 5. Rollback

If a refresh pulls a broken image and member challenges start failing:

```bash
# Find the previous dated tag (refresh.sh logs them) and pin it:
docker pull ghcr.io/yuhtin/ics-sandbox-python:stable-20260517

# Retag locally so the API (which uses :stable) picks it up:
docker tag ghcr.io/yuhtin/ics-sandbox-python:stable-20260517 \
           ghcr.io/yuhtin/ics-sandbox-python:stable

# Disable the cron temporarily to stop the next pull from clobbering it:
sudo crontab -l | grep -v refresh.sh | sudo crontab -

# After fixing upstream, restore the cron line.
```
