# syntax=docker/dockerfile:1
# Stages: deps -> build -> runner (Next standalone) and tools (full deps + source for db:migrate / seed:*).

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps: every dependency, cached on the manifests only
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build: Next production build (output: standalone)
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# Next evaluates the route modules while building, so the required variables must exist. These are
# throw-away placeholders for the build only (inline, not stored in the image); the real values
# are read at runtime. The database is never contacted during the build.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder-not-a-secret-0000 \
    pnpm build

# ---- tools: one-shot commands (migrations, first admin, demo seed). Not part of the running app.
# NODE_ENV=production keeps `seed:demo --reset` refused here.
FROM deps AS tools
ENV NODE_ENV=production
COPY . .
ENTRYPOINT ["node_modules/.bin/tsx", "--import", "./scripts/lib/server-only-shim.mjs"]
CMD ["scripts/db-migrate.ts"]

# ---- runner: the web app, no dev dependencies and no source
FROM node:24-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    UPLOAD_DIR=/app/uploads
WORKDIR /app
RUN mkdir -p /app/uploads && chown node:node /app/uploads
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
