#!/usr/bin/env node
// Ops utility: credit a player's wallet outside the normal game flows
// (testing, support cases). Goes through the same ledger invariants as
// WalletService.credit() — balance increment + a matching
// ADMIN_ADJUSTMENT WalletTransaction row — so it shows up correctly in
// the admin wallet-transactions view.
//
// Usage (run from the api container, where packages/database is built):
//   node scripts/grant-credits.js <email> <amount>
//
// Example:
//   node scripts/grant-credits.js admin@railcards.local 1000

const { createPrismaClient } = require("../packages/database/dist/index.js");

const [, , email, amountArg] = process.argv;
const amount = Number(amountArg);

if (!email || !Number.isInteger(amount) || amount <= 0) {
  console.error("Usage: node scripts/grant-credits.js <email> <amount>");
  process.exit(1);
}

const prisma = createPrismaClient();

(async () => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId: user.id },
      create: { userId: user.id, balance: 0 },
      update: {},
    });
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount,
        balanceAfter: updated.balance,
        type: "ADMIN_ADJUSTMENT",
        referenceType: "manual-grant",
      },
    });
    return updated;
  });

  console.log(`${email}: +${amount} CR -> nouveau solde ${result.balance} CR`);
  await prisma.$disconnect();
})();
