import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { GAME_CONSTANTS } from "@railcards/game-domain";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../economy/wallet.service";
import { generateOpaqueToken, hashOpaqueToken } from "../common/utils/tokens";
import { parseDurationToMs } from "../common/utils/duration";
import type { RegisterDto } from "./dto/register.dto";
import type { LoginDto } from "./dto/login.dto";
import type { AccessTokenPayload, AuthenticatedUser } from "./auth.types";

const BCRYPT_ROUNDS = 12;

export interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly wallet: WalletService,
  ) {}

  private toAuthenticatedUser(user: {
    id: string;
    username: string;
    email: string;
    role: "USER" | "ADMIN";
    status: "ACTIVE" | "SUSPENDED" | "BANNED";
  }): AuthenticatedUser {
    return { id: user.id, username: user.username, email: user.email, role: user.role, status: user.status };
  }

  private signAccessToken(user: AuthenticatedUser): string {
    const payload: AccessTokenPayload = { sub: user.id, username: user.username, role: user.role };
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: (this.config.get<string>("JWT_ACCESS_TTL") ?? "15m") as never,
    });
  }

  private async createSession(userId: string, meta: SessionMeta) {
    const rawToken = generateOpaqueToken();
    const ttlMs = parseDurationToMs(this.config.get<string>("JWT_REFRESH_TTL") ?? "30d");
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: hashOpaqueToken(rawToken),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt,
      },
    });
    return { rawToken, expiresAt };
  }

  async register(dto: RegisterDto, meta: SessionMeta): Promise<AuthResult> {
    const inviteOnly = this.config.get<boolean>("INVITE_ONLY_MODE") ?? true;

    const [existingEmail, existingUsername] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } }),
      this.prisma.user.findUnique({ where: { username: dto.username.toLowerCase() } }),
    ]);
    if (existingEmail) throw new ConflictException("Email already registered");
    if (existingUsername) throw new ConflictException("Username already taken");

    let invitationId: string | null = null;
    if (inviteOnly) {
      if (!dto.invitationCode) {
        throw new ForbiddenException("An invitation code is required to join RailCards right now");
      }
      const invitation = await this.prisma.invitation.findUnique({ where: { code: dto.invitationCode } });
      if (!invitation) throw new BadRequestException("Invalid invitation code");
      if (invitation.expiresAt && invitation.expiresAt < new Date()) {
        throw new BadRequestException("This invitation code has expired");
      }
      if (invitation.useCount >= invitation.maxUses) {
        throw new BadRequestException("This invitation code has already been used");
      }
      if (invitation.email && invitation.email.toLowerCase() !== dto.email.toLowerCase()) {
        throw new BadRequestException("This invitation code is bound to a different email address");
      }
      invitationId = invitation.id;
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          username: dto.username.toLowerCase(),
          displayName: dto.displayName,
          passwordHash,
          profile: { create: {} },
          wallet: { create: { balance: 0 } },
        },
      });

      if (invitationId) {
        const invitation = await tx.invitation.findUniqueOrThrow({ where: { id: invitationId } });
        const result = await tx.invitation.updateMany({
          where: { id: invitationId, useCount: { lt: invitation.maxUses } },
          data: {
            useCount: { increment: 1 },
            ...(invitation.maxUses === 1
              ? { usedByUserId: createdUser.id, usedAt: new Date() }
              : {}),
          },
        });
        if (result.count === 0) {
          throw new BadRequestException("This invitation code has just been used up");
        }
      }

      // Welcome bonus: idempotent per user, granted exactly once at registration.
      await this.wallet.credit(tx, {
        userId: createdUser.id,
        amount: GAME_CONSTANTS.WELCOME_BONUS_CR,
        type: "WELCOME_BONUS",
        referenceType: "User",
        referenceId: createdUser.id,
        idempotencyKey: `welcome-bonus-${createdUser.id}`,
      });

      return createdUser;
    });

    const authUser = this.toAuthenticatedUser(user);
    const accessToken = this.signAccessToken(authUser);
    const { rawToken, expiresAt } = await this.createSession(user.id, meta);

    return { accessToken, refreshToken: rawToken, refreshTokenExpiresAt: expiresAt, user: authUser };
  }

  async login(dto: LoginDto, meta: SessionMeta): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) throw new UnauthorizedException("Invalid email or password");

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException("Invalid email or password");

    if (user.status !== "ACTIVE") {
      throw new ForbiddenException("This account is suspended or banned");
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const authUser = this.toAuthenticatedUser(user);
    const accessToken = this.signAccessToken(authUser);
    const { rawToken, expiresAt } = await this.createSession(user.id, meta);

    return { accessToken, refreshToken: rawToken, refreshTokenExpiresAt: expiresAt, user: authUser };
  }

  async refresh(rawToken: string, meta: SessionMeta): Promise<AuthResult> {
    const tokenHash = hashOpaqueToken(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    if (!session) throw new UnauthorizedException("Invalid session");

    if (session.revokedAt) {
      // Reuse of an already-rotated refresh token: treat as a potential
      // theft and revoke every session for this user as a precaution.
      await this.prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Session has been revoked; please log in again");
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException("Session expired");
    }

    if (session.user.status !== "ACTIVE") {
      throw new ForbiddenException("This account is suspended or banned");
    }

    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });

    const authUser = this.toAuthenticatedUser(session.user);
    const accessToken = this.signAccessToken(authUser);
    const { rawToken: newRawToken, expiresAt } = await this.createSession(session.userId, meta);

    return { accessToken, refreshToken: newRawToken, refreshTokenExpiresAt: expiresAt, user: authUser };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const tokenHash = hashOpaqueToken(rawToken);
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
