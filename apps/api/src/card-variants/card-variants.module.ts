import { Module } from "@nestjs/common";
import { CardVariantsService } from "./card-variants.service";
import { CardVariantsController } from "./card-variants.controller";

@Module({
  controllers: [CardVariantsController],
  providers: [CardVariantsService],
  exports: [CardVariantsService],
})
export class CardVariantsModule {}
