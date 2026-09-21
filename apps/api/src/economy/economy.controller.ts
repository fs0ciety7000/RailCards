import { Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { WalletService } from "./wallet.service";
import { DailyRewardService } from "./daily-reward.service";

@ApiTags("wallet")
@ApiBearerAuth()
@Controller({ path: "wallet", version: "1" })
export class EconomyController {
  constructor(
    private readonly wallet: WalletService,
    private readonly dailyReward: DailyRewardService,
  ) {}

  @Get()
  async getWallet(@CurrentUser() user: AuthenticatedUser) {
    const balance = await this.wallet.getBalance(user.id);
    return { balance, currency: "CR" };
  }

  @Get("transactions")
  async getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "20",
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const { items, total } = await this.wallet.listTransactions(user.id, p, ps);
    return { items, page: p, pageSize: ps, total, totalPages: Math.ceil(total / ps) };
  }

  @Get("daily-reward")
  async dailyRewardStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.dailyReward.status(user.id);
  }

  @Post("daily-reward/claim")
  async claimDailyReward(@CurrentUser() user: AuthenticatedUser) {
    return this.dailyReward.claim(user.id);
  }
}
