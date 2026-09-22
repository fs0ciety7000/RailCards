import { Module } from "@nestjs/common";
import { CollectionModule } from "../collection/collection.module";
import { StorageModule } from "../storage/storage.module";
import { GradesModule } from "../grades/grades.module";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";

@Module({
  imports: [CollectionModule, StorageModule, GradesModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
