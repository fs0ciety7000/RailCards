#!/usr/bin/env node
// Ops utility: promote an existing registered user to ADMIN. There is
// deliberately no API endpoint for this (role changes are never accepted
// from a client, by design — see apps/api/test/admin.e2e-spec.ts) — run
// this directly in the api container.
//
// Usage (run from the api container, where packages/database is built):
//   node scripts/set-admin-role.js <email>

const { createPrismaClient } = require("../packages/database/dist/index.js");

const [, , email] = process.argv;

if (!email) {
  console.error("Usage: node scripts/set-admin-role.js <email>");
  process.exit(1);
}

const prisma = createPrismaClient();

(async () => {
  const user = await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
  });
  console.log(`${user.email} (@${user.username}) is now ADMIN.`);
  await prisma.$disconnect();
})();
