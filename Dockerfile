# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=20-alpine

# Stage 1: deps
FROM node:${NODE_VERSION} AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/prisma/package.json packages/prisma/
RUN pnpm install --frozen-lockfile

# Stage 2: build
FROM deps AS build
COPY packages/shared packages/shared
COPY packages/prisma packages/prisma
COPY apps/api apps/api
RUN pnpm --filter @ics-select/prisma exec prisma generate
RUN pnpm --filter @ics-select/shared build
RUN pnpm --filter @ics-select/api build
RUN pnpm --filter @ics-select/api deploy --prod /out

# Stage 3: runtime
FROM node:${NODE_VERSION} AS runtime
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY --from=build /repo/packages/prisma/generated ./node_modules/@ics-select/prisma/generated
COPY --from=build /repo/packages/prisma/prisma ./node_modules/@ics-select/prisma/prisma
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
