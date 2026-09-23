import { Module } from "@nestjs/common";
import { WantedListingsService } from "./wanted-listings.service";
import { WantedListingsController } from "./wanted-listings.controller";

@Module({
  controllers: [WantedListingsController],
  providers: [WantedListingsService],
  exports: [WantedListingsService],
})
export class WantedListingsModule {}
