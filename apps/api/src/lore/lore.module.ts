import { Module } from "@nestjs/common";
import { LoreService } from "./lore.service";
import { LoreController } from "./lore.controller";

@Module({
  controllers: [LoreController],
  providers: [LoreService],
})
export class LoreModule {}
