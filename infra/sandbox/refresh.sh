#!/usr/bin/env bash
# Weekly refresh of sandbox images on the VPS host. Pulls the latest stable
# tag for each language image and prunes dangling layers. Designed to be
# crontabbed Sundays ~07:00 BRT, so any CVE patch that landed in the
# upstream base image during the week reaches the VPS within ~7 days.
#
# Install:
#   sudo cp infra/sandbox/refresh.sh /opt/ics-sandbox/refresh.sh
#   sudo chmod +x /opt/ics-sandbox/refresh.sh
#   sudo crontab -e
#     0 7 * * 0 /opt/ics-sandbox/refresh.sh >> /var/log/ics-sandbox-refresh.log 2>&1
#
# Image names mirror the API env vars SANDBOX_PYTHON_IMAGE / SANDBOX_CPP_IMAGE.
# Change here AND in apps/api/.env on the EasyPanel container if you ever
# move registry or rename images.

set -euo pipefail

IMAGES=(
  "ghcr.io/yuhtin/ics-sandbox-python:stable"
  "ghcr.io/yuhtin/ics-sandbox-cpp:stable"
)

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
}

log "refresh started"

for image in "${IMAGES[@]}"; do
  log "pulling $image"
  if docker pull "$image"; then
    log "pulled $image OK"
  else
    log "FAILED to pull $image (continuing)"
  fi
done

log "pruning dangling layers"
docker image prune -f --filter "label=org.opencontainers.image.source=https://github.com/yuhtin/ics-select"

log "refresh done"
