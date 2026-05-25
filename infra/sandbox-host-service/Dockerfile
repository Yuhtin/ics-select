# sandbox-host-service. Sits between the API container and the host's
# Docker daemon. Holds the docker socket so the API container doesn't
# have to. Tiny: Node + docker CLI + a single mjs file.
#
# Built by .github/workflows/sandbox-host-image.yml. Pulled by the host
# via systemd (see infra/sandbox-host-service/systemd/ics-sandbox-host.service).
FROM node:24-slim

# docker CLI (no engine — we talk to the host daemon via the mounted
# socket). Keep apt cache out of the image.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      gnupg \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
 && chmod a+r /etc/apt/keyrings/docker.gpg \
 && . /etc/os-release \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" \
      > /etc/apt/sources.list.d/docker.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends docker-ce-cli \
 && apt-get purge -y --auto-remove curl gnupg \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

WORKDIR /app
COPY src ./src

# Runs as root because it needs to call docker via the mounted socket.
# All actual code execution happens inside the per-request sandbox
# containers, which run as `runner` (UID 10001) with cap-drop=ALL etc.
CMD ["node", "src/server.mjs"]
