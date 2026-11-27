# syntax=docker/dockerfile:1.7
# The dashboard as a container, for the local demo. Build from the repo root:
#   docker compose --profile dashboard up -d --build dashboard
# Runs Next's standalone server, so the image carries no dev dependencies.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/collector/package.json packages/collector/
COPY packages/testkit/package.json packages/testkit/
COPY services/api/package.json services/api/
COPY services/ingest-mock/package.json services/ingest-mock/
COPY apps/dashboard/package.json apps/dashboard/
COPY e2e/package.json e2e/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/dashboard apps/dashboard
# Next resolves workspace packages to dist/, so contracts builds first.
RUN pnpm --filter @fwcoach/contracts build && pnpm --filter @fwcoach/dashboard build

FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
# Docker sets HOSTNAME to the container ID, and the standalone server binds to it.
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/dashboard/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=build --chown=node:node /repo/apps/dashboard/public ./apps/dashboard/public
USER node
EXPOSE 3000
CMD ["node", "apps/dashboard/server.js"]
