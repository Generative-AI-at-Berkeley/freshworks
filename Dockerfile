# syntax=docker/dockerfile:1.7
# One image definition for every service. Pick one with --build-arg SERVICE=api.
# Used by docker compose for local dev and the staging demo.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS build
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

FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deploy --chown=node:node /out ./
USER node
CMD ["node", "dist/main.js"]
