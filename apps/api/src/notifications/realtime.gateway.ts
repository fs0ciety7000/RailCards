import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { AccessTokenPayload } from "../auth/auth.types";

/**
 * Minimal realtime layer: authenticated notification push + basic
 * presence. Deliberately not the source of truth for anything — every
 * event here mirrors state that already exists in Postgres, so a client
 * that never connects (or a server restart) never loses data, only the
 * "live" convenience of not having to poll.
 *
 * Known limitation: presence/rooms are held in-memory, so this does not
 * fan out correctly across multiple API instances without a Redis
 * adapter for Socket.IO. Fine for a single-instance MVP deployment; see
 * docs/architecture/known-limitations.md.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true }, namespace: "/realtime" })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly onlineUserIds = new Set<string>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(@ConnectedSocket() socket: Socket) {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error("missing token");
      const payload = this.jwt.verify<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
      socket.data.userId = payload.sub;
      socket.join(`user:${payload.sub}`);
      this.onlineUserIds.add(payload.sub);
    } catch {
      this.logger.warn(`Rejected unauthenticated realtime connection ${socket.id}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() socket: Socket) {
    const userId = socket.data?.userId as string | undefined;
    if (userId) this.onlineUserIds.delete(userId);
  }

  isOnline(userId: string): boolean {
    return this.onlineUserIds.has(userId);
  }

  pushNotification(userId: string, notification: unknown) {
    this.server?.to(`user:${userId}`).emit("notification", notification);
  }

  /**
   * Fans an event out to several users' personal rooms at once — e.g. a
   * guild chat message to every current member. Reuses the same per-user
   * rooms `pushNotification` already relies on rather than introducing
   * guild-scoped rooms, so guild membership changes need no join/leave
   * bookkeeping on the socket itself.
   */
  pushToUsers(userIds: string[], event: string, payload: unknown) {
    for (const userId of userIds) {
      this.server?.to(`user:${userId}`).emit(event, payload);
    }
  }
}
