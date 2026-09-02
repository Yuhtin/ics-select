# Sandbox image for C++ 17. Same hardening contract as Dockerfile.python:
# minimal surface, non-root runner, no networking. The image carries g++
# only — no debugger, no make, no package manager, no shell utilities
# beyond busybox basics that come with debian:stable-slim.
#
# We use debian:stable-slim + g++ (not gcc:13) because the official gcc
# image carries the full GNU toolchain (make, autoconf, libtool, etc) plus
# system headers we don't need. A bare debian + g++ install is ~120MB vs
# ~1.2GB for gcc:13 and removes a lot of potentially exploitable binaries.
FROM debian:stable-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      g++ \
      libstdc++-12-dev \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

RUN groupadd --system --gid 10001 runner \
 && useradd --system --uid 10001 --gid runner --no-create-home --shell /sbin/nologin runner

RUN mkdir -p /code && chown runner:runner /code

USER runner
WORKDIR /code

# Orchestrator runs `bash -c "g++ -O2 -std=c++17 main.cpp -o main && ./main"`
# explicitly with stdin redirected. No CMD here.
