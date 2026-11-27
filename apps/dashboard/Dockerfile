# syntax=docker/dockerfile:1.7
# The dashboard as a container, for the local demo. Build from the repo root:
#   docker compose --profile dashboard up -d --build dashboard
# Runs Next's standalone server, so the image carries no dev dependencies.

# node:24-slim, pinned by digest so a rebuild gets the same base. Dependabot
# bumps the digest. Keep the tag in step with .nvmrc.
FROM node:24-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530 AS build
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

# node:24-slim
FROM node:24-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530 AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
# Same reasoning as the root Dockerfile: Debian fixes, and no npm, corepack or
# yarn in a server that never runs them.
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/* \
  && rm -rf /usr/local/lib/node_modules /opt/yarn-* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
# Docker sets HOSTNAME to the container ID, and the standalone server binds to it.
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/dashboard/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=build --chown=node:node /repo/apps/dashboard/public ./apps/dashboard/public
USER node
EXPOSE 3000
# Same probe as docker-compose.yml.
HEALTHCHECK --interval=5s --timeout=3s --retries=20 \
  CMD ["node", "-e", "fetch(`http://localhost:${process.env.PORT||3000}/api/session`).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "apps/dashboard/server.js"]
