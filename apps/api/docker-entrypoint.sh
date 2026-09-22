#!/bin/sh
set -e

# Runs as root (see Dockerfile — USER is dropped here, not before). The
# uploads volume may be freshly created — and root-owned — on first deploy,
# since named volumes don't always inherit the image's ownership at that
# mount point depending on how the orchestrator provisions them. Fix that
# up before the app (running as nestjs) ever tries to write to it.
mkdir -p /app/storage/uploads
chown -R nestjs:nodejs /app/storage

echo "[api] applying pending Prisma migrations..."
su-exec nestjs pnpm --filter @railcards/database prisma:migrate:deploy

echo "[api] starting..."
exec su-exec nestjs "$@"
