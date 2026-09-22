import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { TradingService } from "./trading.service";
import { CounterTradeDto, CreateTradeDto } from "./dto/create-trade.dto";

@ApiTags("trading")
@ApiBearerAuth()
@Controller({ path: "trades", version: "1" })
export class TradingController {
  constructor(private readonly trading: TradingService) {}

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTradeDto) {
    return this.trading.create({
      initiatorId: user.id,
      recipientUsername: dto.recipientUsername,
      offeredCardInstanceIds: dto.offeredCardInstanceIds,
      requestedCardInstanceIds: dto.requestedCardInstanceIds,
      initiatorCr: dto.initiatorCr,
      recipientCr: dto.recipientCr,
      message: dto.message,
      expiresInHours: dto.expiresInHours,
    });
  }

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("direction") direction: "sent" | "received" | "all" = "all",
    @Query("status") status?: string,
  ) {
    return this.trading.list(user.id, direction, status);
  }

  @Get(":id")
  async getById(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.trading.getById(user.id, id);
  }

  @Post(":id/counter")
  async counter(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: CounterTradeDto) {
    return this.trading.counter({
      counterUserId: user.id,
      originalTradeId: id,
      offeredCardInstanceIds: dto.offeredCardInstanceIds,
      requestedCardInstanceIds: dto.requestedCardInstanceIds,
      initiatorCr: dto.initiatorCr,
      recipientCr: dto.recipientCr,
      message: dto.message,
      expiresInHours: dto.expiresInHours,
    });
  }

  @Post(":id/accept")
  async accept(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.trading.accept(user.id, id);
  }

  @Post(":id/reject")
  async reject(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.trading.reject(user.id, id);
  }

  @Post(":id/cancel")
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.trading.cancel(user.id, id);
  }
}
