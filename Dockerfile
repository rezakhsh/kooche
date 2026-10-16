# syntax=docker/dockerfile:1
# One Dockerfile, two targets (docs/setup.md, decision 8):
#   docker build --target web .     Next.js standalone server on port 3000
#   docker build --target worker .  background worker (outbox poller, BullMQ jobs)
# Both run as the image's unprivileged `node` user. No secrets at build time: every setting is
# read from the environment when the process starts.

ARG NODE_IMAGE=node:24.22.0-bookworm-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Checks shared by both targets
FROM deps AS source
COPY . .
RUN npm run typecheck && npm run check:rtl

FROM source AS web-build
RUN npm run build

FROM source AS worker-build
RUN npm run build:worker

FROM ${NODE_IMAGE} AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# Application files stay owned by root (read-only for the app); only Next's cache is writable.
COPY --from=web-build /app/.next/standalone ./
COPY --from=web-build /app/.next/static ./.next/static
RUN mkdir -p .next/cache && chown node:node .next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]

FROM ${NODE_IMAGE} AS worker
WORKDIR /app
ENV NODE_ENV=production
# One bundled file, no node_modules
COPY --from=worker-build /app/dist/worker.js ./worker.js
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "const s = require('node:fs').statSync('/tmp/worker-heartbeat'); process.exit(Date.now() - s.mtimeMs < 30000 ? 0 : 1)"]
CMD ["node", "worker.js"]
