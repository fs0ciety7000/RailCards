import { Module } from "@nestjs/common";
import { CollectionModule } from "../collection/collection.module";
import { StorageModule } from "../storage/storage.module";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";

@Module({
  imports: [CollectionModule, StorageModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
