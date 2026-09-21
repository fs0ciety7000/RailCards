import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { RealtimeGateway } from "./realtime.gateway";

@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [NotificationsService, RealtimeGateway],
  exports: [NotificationsService],
})
export class NotificationsModule {}
