# syntax=docker/dockerfile:1.7
#
# Production image for @railcards/worker (BullMQ trade-expiry sweep job).
# Build from the REPOSITORY ROOT so the pnpm workspace is visible:
#
#   docker build -f apps/worker/Dockerfile -t railcards-worker .
#
# Migrations are owned by the api container (see apps/api/Dockerfile); the
# worker only needs an already-migrated database.

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- prune the monorepo down to what apps/worker actually needs ----
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo prune @railcards/worker --docker

# ---- install + build the pruned workspace ----
FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json tsconfig.base.json
# The Prisma schema lives at the repo root, outside any workspace package,
# so `turbo prune` doesn't pick it up automatically. @railcards/database
# needs the generated client to build.
COPY prisma prisma

RUN pnpm --filter @railcards/database prisma:generate
RUN pnpm turbo run build

# ---- runtime image ----
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S worker -G nodejs
COPY --from=installer --chown=worker:nodejs /app /app
USER worker

CMD ["node", "apps/worker/dist/index.js"]
