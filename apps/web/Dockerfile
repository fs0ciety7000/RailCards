# syntax=docker/dockerfile:1.7
#
# Production image for @railcards/web (Next.js). Build from the REPOSITORY
# ROOT so the pnpm workspace is visible:
#
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.railcards.fs0ciety.org/api/v1 \
#     --build-arg NEXT_PUBLIC_WS_URL=https://api.railcards.fs0ciety.org \
#     -t railcards-web .
#
# NEXT_PUBLIC_* variables are inlined into the client bundle by `next build`,
# so they must be passed as build args (Coolify: "Build Variables"), not just
# runtime environment variables.

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- prune the monorepo down to what apps/web actually needs ----
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo prune @railcards/web --docker

# ---- install + build the pruned workspace ----
FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json tsconfig.base.json

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}

RUN pnpm turbo run build

# ---- minimal runtime image (Next.js standalone output) ----
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
