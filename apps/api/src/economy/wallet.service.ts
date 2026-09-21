import { Injectable } from "@nestjs/common";
import { Prisma, type WalletTransactionType } from "@railcards/database";
import { PrismaService } from "../prisma/prisma.service";
import { InsufficientFundsException } from "./wallet.exceptions";

type Tx = Prisma.TransactionClient;

export interface LedgerEntryParams {
  userId: string;
  amount: number; // positive integer, sign is implied by credit/debit
  type: WalletTransactionType;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

/**
 * All balance changes in RailCards go through this service so that:
 *  - amounts are always whole Crédits Rail (never floats),
 *  - the wallet can never go negative (guarded in application code AND by
 *    a DB CHECK constraint as defense in depth),
 *  - every movement is journaled in WalletTransaction,
 *  - operations are idempotent when called with an idempotencyKey.
 *
 * Every method takes a Prisma transaction client so callers can compose
 * wallet changes atomically with the rest of a larger operation (booster
 * purchase, trade settlement, market sale, ...).
 */
@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateWallet(tx: Tx, userId: string) {
    const existing = await tx.wallet.findUnique({ where: { userId } });
    if (existing) return existing;
    return tx.wallet.create({ data: { userId, balance: 0 } });
  }

  private async findByIdempotencyKey(tx: Tx, idempotencyKey: string) {
    return tx.walletTransaction.findUnique({ where: { idempotencyKey } });
  }

  async credit(tx: Tx, params: LedgerEntryParams) {
    if (!Number.isInteger(params.amount) || params.amount <= 0) {
      throw new Error("Credit amount must be a positive integer");
    }
    if (params.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(tx, params.idempotencyKey);
      if (existing) return existing;
    }

    const wallet = await this.getOrCreateWallet(tx, params.userId);
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: params.amount } },
    });

    return tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: params.amount,
        balanceAfter: updated.balance,
        type: params.type,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        idempotencyKey: params.idempotencyKey,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async debit(tx: Tx, params: LedgerEntryParams) {
    if (!Number.isInteger(params.amount) || params.amount <= 0) {
      throw new Error("Debit amount must be a positive integer");
    }
    if (params.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(tx, params.idempotencyKey);
      if (existing) return existing;
    }

    const wallet = await this.getOrCreateWallet(tx, params.userId);
    if (wallet.balance < params.amount) {
      throw new InsufficientFundsException(params.amount, wallet.balance);
    }

    // Conditional update guards against a concurrent debit racing us between
    // the read above and this write: it only succeeds if the balance is
    // still sufficient at write time (row-level atomicity in Postgres).
    const updateResult = await tx.wallet.updateMany({
      where: { id: wallet.id, balance: { gte: params.amount } },
      data: { balance: { decrement: params.amount } },
    });
    if (updateResult.count === 0) {
      const fresh = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      throw new InsufficientFundsException(params.amount, fresh.balance);
    }

    const updated = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });

    return tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: -params.amount,
        balanceAfter: updated.balance,
        type: params.type,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        idempotencyKey: params.idempotencyKey,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async getBalance(userId: string): Promise<number> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    return wallet?.balance ?? 0;
  }

  async listTransactions(userId: string, page: number, pageSize: number) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return { items: [], total: 0 };
    const [items, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);
    return { items, total };
  }
}
