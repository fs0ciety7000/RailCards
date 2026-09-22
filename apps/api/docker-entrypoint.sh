#!/bin/sh
set -e

echo "[api] applying pending Prisma migrations..."
pnpm --filter @railcards/database prisma:migrate:deploy

echo "[api] starting..."
exec "$@"
