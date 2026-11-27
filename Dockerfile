# syntax=docker/dockerfile:1.7
# One image definition for every service. Pick one with --build-arg SERVICE=api.
# Used by docker compose for local dev and the staging demo.

# node:24-slim, pinned by digest so a rebuild gets the same base. Dependabot
# bumps the digest. Keep the tag in step with .nvmrc.
FROM node:24-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530 AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/collector/package.json packages/collector/
COPY packages/testkit/package.json packages/testkit/
COPY services/api/package.json services/api/
COPY services/ingest-mock/package.json services/ingest-mock/
COPY e2e/package.json e2e/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.base.json ./
COPY packages packages
COPY services services
RUN pnpm -r --filter "./packages/*" --filter "./services/*" run build

FROM build AS deploy
ARG SERVICE
# pnpm deploy copies one service with only its production dependencies.
RUN test -n "$SERVICE" && pnpm --filter "@fwcoach/${SERVICE}" deploy --prod --legacy /out

# node:24-slim
FROM node:24-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530 AS runtime
ARG SERVICE
ENV NODE_ENV=production FWCOACH_SERVICE=${SERVICE}
# Debian ships security fixes faster than the Node image is rebuilt, so pick
# them up here. npm, corepack and yarn are never used at runtime and carry
# their own CVEs, so they go.
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/* \
  && rm -rf /usr/local/lib/node_modules /opt/yarn-* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
COPY --from=deploy --chown=node:node /out ./
USER node
# Same probes as docker-compose.yml. The port follows the variable the service
# reads, so a remapped port is still the one checked.
HEALTHCHECK --interval=5s --timeout=3s --retries=10 \
  CMD ["node", "-e", "const e=process.env;const u=e.FWCOACH_SERVICE==='api'?`http://localhost:${e.API_PORT||8080}/readyz`:`http://localhost:${e.INGEST_PORT||4318}/healthz`;fetch(u).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
