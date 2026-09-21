import { prisma } from "@railcards/database";

/**
 * Proactively expires trade proposals past their `expiresAt` and releases
 * the initiator's reserved card instances back to AVAILABLE.
 *
 * This is a convenience sweep, not a correctness requirement: the API
 * itself also lazily expires a trade the moment anyone tries to accept
 * it past its deadline (see apps/api TradingService.accept). Without this
 * job, an expired trade nobody ever touches again would otherwise leave
 * its cards stuck in RESERVED_TRADE forever.
 */
export async function expireStaleTrades(): Promise<{ expiredCount: number }> {
  const now = new Date();
  const staleTrades = await prisma.trade.findMany({
    where: { status: "PENDING", expiresAt: { lt: now } },
    select: { id: true },
  });

  let expiredCount = 0;
  for (const trade of staleTrades) {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.trade.updateMany({
        where: { id: trade.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      if (claim.count === 0) return; // someone else already resolved it

      const items = await tx.tradeItem.findMany({ where: { tradeId: trade.id, side: "INITIATOR" } });
      if (items.length > 0) {
        await tx.cardInstance.updateMany({
          where: { id: { in: items.map((i) => i.cardInstanceId) }, state: "RESERVED_TRADE" },
          data: { state: "AVAILABLE" },
        });
      }
      expiredCount += 1;
    });
  }

  return { expiredCount };
}
