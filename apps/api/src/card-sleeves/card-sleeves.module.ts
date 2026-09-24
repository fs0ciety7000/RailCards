import { Module } from "@nestjs/common";
import { CardSleevesService } from "./card-sleeves.service";
import { CardSleevesController } from "./card-sleeves.controller";

@Module({
  controllers: [CardSleevesController],
  providers: [CardSleevesService],
  exports: [CardSleevesService],
})
export class CardSleevesModule {}
