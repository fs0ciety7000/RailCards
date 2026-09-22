# syntax=docker/dockerfile:1.7
#
# Production image for @railcards/api (NestJS). Build from the REPOSITORY
# ROOT so the pnpm workspace is visible:
#
#   docker build -f apps/api/Dockerfile -t railcards-api .
#
# On every container start, the entrypoint runs `prisma migrate deploy`
# (idempotent — a no-op once the schema is up to date) before starting the
# server, so a redeploy always ships with an up-to-date schema.

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- prune the monorepo down to what apps/api actually needs ----
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo prune @railcards/api --docker

# ---- install + build the pruned workspace ----
FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json tsconfig.base.json
# The Prisma schema/migrations and the ops scripts (grant-credits.js,
# set-admin-role.js, ...) live at the repo root, outside any workspace
# package, so `turbo prune` doesn't pick them up automatically.
COPY prisma prisma
COPY scripts scripts

RUN pnpm --filter @railcards/database prisma:generate
RUN pnpm turbo run build

# ---- runtime image ----
# The full pruned workspace (node_modules included) is carried into the
# runtime image as-is: pnpm's node_modules is symlink-heavy, and copying
# only selected subfolders across stages risks breaking those symlinks.
# This keeps the image larger than a fully-pruned one, but correct.
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs
COPY --from=installer --chown=nestjs:nodejs /app /app
RUN chmod +x /app/apps/api/docker-entrypoint.sh
USER nestjs

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://localhost:'+(process.env.API_PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

EXPOSE 4000
ENTRYPOINT ["/app/apps/api/docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
